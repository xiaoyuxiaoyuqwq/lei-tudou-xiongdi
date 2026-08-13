/**
 * GLB → 纯几何数据烘焙器
 *
 * 为什么需要它：游戏要能在 file:// 下双击直接运行，而 ESM / GLTFLoader
 * 在 file:// 协议下会被 CORS 挡掉。所以把 GLB 在构建期解析成
 * 「顶点 + 法线 + 索引 + 材质色」的紧凑数据，运行时零依赖直接建 BufferGeometry。
 *
 * 输出：assets/meshes.js  →  window.MESHES
 * 用法：node tools/bake_models.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC  = path.join(ROOT, 'models_tmp');
const OUT  = path.join(ROOT, 'assets', 'meshes.js');

/* ---------------- GLB 容器解析 ---------------- */
function parseGLB(buf){
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('不是合法 GLB');
  const total = dv.getUint32(8, true);
  let off = 12, json = null, bin = null;
  while (off + 8 <= total){
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data));
    else if (type === 0x004E4942) bin = data;
    off += 8 + len;
  }
  return { json, bin };
}

/* ---------------- accessor 读取（支持 interleaved / 各种 componentType） ---------------- */
const COMP = {
  5120: { A: Int8Array,    sz: 1, norm: v => Math.max(v / 127, -1) },
  5121: { A: Uint8Array,   sz: 1, norm: v => v / 255 },
  5122: { A: Int16Array,   sz: 2, norm: v => Math.max(v / 32767, -1) },
  5123: { A: Uint16Array,  sz: 2, norm: v => v / 65535 },
  5125: { A: Uint32Array,  sz: 4, norm: v => v },
  5126: { A: Float32Array, sz: 4, norm: v => v },
};
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAccessor(g, bin, idx){
  const acc = g.accessors[idx];
  const n   = NUM[acc.type];
  const cp  = COMP[acc.componentType];
  const out = new Float32Array(acc.count * n);
  if (acc.bufferView == null) return out;           // sparse-only / 全零

  const bv     = g.bufferViews[acc.bufferView];
  const base   = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || (n * cp.sz);
  const dv     = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const get = {
    5120: (o) => dv.getInt8(o),      5121: (o) => dv.getUint8(o),
    5122: (o) => dv.getInt16(o, true), 5123: (o) => dv.getUint16(o, true),
    5125: (o) => dv.getUint32(o, true), 5126: (o) => dv.getFloat32(o, true),
  }[acc.componentType];

  for (let i = 0; i < acc.count; i++){
    for (let c = 0; c < n; c++){
      const raw = get(base + i * stride + c * cp.sz);
      out[i * n + c] = acc.normalized ? cp.norm(raw) : raw;
    }
  }
  return out;
}

/* ---------------- 4x4 矩阵（列主序，同 glTF / three） ---------------- */
const mIdent = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mMul(a, b){                                  // a * b
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){
    o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
  }
  return o;
}
function trsToMat(t, r, s){
  const [x,y,z,w] = r, [sx,sy,sz] = s;
  const x2=x+x, y2=y+y, z2=z+z;
  const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2;
  const wx=w*x2, wy=w*y2, wz=w*z2;
  return [
    (1-(yy+zz))*sx, (xy+wz)*sx,     (xz-wy)*sx,     0,
    (xy-wz)*sy,     (1-(xx+zz))*sy, (yz+wx)*sy,     0,
    (xz+wy)*sz,     (yz-wx)*sz,     (1-(xx+yy))*sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
function nodeMatrix(nd){
  if (nd.matrix) return nd.matrix.slice();
  return trsToMat(nd.translation || [0,0,0], nd.rotation || [0,0,0,1], nd.scale || [1,1,1]);
}
const applyPos = (m, x, y, z) => [
  m[0]*x + m[4]*y + m[8]*z  + m[12],
  m[1]*x + m[5]*y + m[9]*z  + m[13],
  m[2]*x + m[6]*y + m[10]*z + m[14],
];
const applyDir = (m, x, y, z) => [
  m[0]*x + m[4]*y + m[8]*z,
  m[1]*x + m[5]*y + m[9]*z,
  m[2]*x + m[6]*y + m[10]*z,
];

/* ---------------- 主流程：GLB → 按材质分组的 parts ---------------- */
function bake(file, opt = {}){
  const { json: g, bin } = parseGLB(fs.readFileSync(path.join(SRC, file)));
  const groups = new Map();   // matIndex -> { pos:[], nrm:[], idx:[], color:[r,g,b], emissive }

  const walk = (nodeIdx, parent) => {
    const nd = g.nodes[nodeIdx];
    const m  = mMul(parent, nodeMatrix(nd));
    if (nd.mesh != null){
      for (const pr of g.meshes[nd.mesh].primitives){
        if (pr.mode != null && pr.mode !== 4) continue;      // 只要三角形
        const P = readAccessor(g, bin, pr.attributes.POSITION);
        const N = pr.attributes.NORMAL != null ? readAccessor(g, bin, pr.attributes.NORMAL) : null;
        const I = pr.indices != null ? readAccessor(g, bin, pr.indices) : null;
        const mi = pr.material == null ? -1 : pr.material;

        if (!groups.has(mi)){
          const mat = mi >= 0 ? (g.materials[mi] || {}) : {};
          const pbr = mat.pbrMetallicRoughness || {};
          const bc  = pbr.baseColorFactor || [0.8, 0.8, 0.8, 1];
          groups.set(mi, {
            pos: [], nrm: [], idx: [],
            color: [bc[0], bc[1], bc[2]],
            metal: pbr.metallicFactor  != null ? pbr.metallicFactor  : 1,
            rough: pbr.roughnessFactor != null ? pbr.roughnessFactor : 1,
            emis: mat.emissiveFactor || [0, 0, 0],
            name: mat.name || ('mat' + mi),
          });
        }
        const G = groups.get(mi);
        const vBase = G.pos.length / 3;
        const vCount = P.length / 3;

        for (let i = 0; i < vCount; i++){
          const p = applyPos(m, P[i*3], P[i*3+1], P[i*3+2]);
          G.pos.push(p[0], p[1], p[2]);
          if (N){
            const d = applyDir(m, N[i*3], N[i*3+1], N[i*3+2]);
            const L = Math.hypot(d[0], d[1], d[2]) || 1;
            G.nrm.push(d[0]/L, d[1]/L, d[2]/L);
          } else G.nrm.push(0, 1, 0);
        }
        if (I) for (let i = 0; i < I.length; i++) G.idx.push(vBase + I[i]);
        else   for (let i = 0; i < vCount; i++)   G.idx.push(vBase + i);
      }
    }
    (nd.children || []).forEach(c => walk(c, m));
  };

  const sceneRoots = g.scenes[g.scene || 0].nodes;
  sceneRoots.forEach(r => walk(r, mIdent()));

  /* --- 归一化：先按 opt.rot 修朝向（欧拉 XYZ，弧度），再居中 + 缩放到目标尺寸 --- */
  const parts = [...groups.values()].filter(p => p.pos.length);
  const rot = opt.rot || [0, 0, 0];
  if (rot[0] || rot[1] || rot[2]){
    const [rx, ry, rz] = rot;
    const rotate = (x, y, z) => {
      let a, b;
      a = y*Math.cos(rx) - z*Math.sin(rx); b = y*Math.sin(rx) + z*Math.cos(rx); y = a; z = b;
      a = x*Math.cos(ry) + z*Math.sin(ry); b = -x*Math.sin(ry) + z*Math.cos(ry); x = a; z = b;
      a = x*Math.cos(rz) - y*Math.sin(rz); b = x*Math.sin(rz) + y*Math.cos(rz); x = a; y = b;
      return [x, y, z];
    };
    for (const p of parts){
      for (let i = 0; i < p.pos.length; i += 3){
        const v = rotate(p.pos[i], p.pos[i+1], p.pos[i+2]);
        p.pos[i] = v[0]; p.pos[i+1] = v[1]; p.pos[i+2] = v[2];
        const n = rotate(p.nrm[i], p.nrm[i+1], p.nrm[i+2]);
        p.nrm[i] = n[0]; p.nrm[i+1] = n[1]; p.nrm[i+2] = n[2];
      }
    }
  }

  const bb = { min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] };
  for (const p of parts) for (let i = 0; i < p.pos.length; i += 3)
    for (let c = 0; c < 3; c++){
      bb.min[c] = Math.min(bb.min[c], p.pos[i+c]);
      bb.max[c] = Math.max(bb.max[c], p.pos[i+c]);
    }
  const ctr  = [0,1,2].map(c => (bb.min[c] + bb.max[c]) / 2);
  const size = [0,1,2].map(c => bb.max[c] - bb.min[c]);
  // 以「最长边」归一到 opt.size（默认 1），保持比例
  const scale = (opt.size || 1) / Math.max(size[0], size[1], size[2]);

  for (const p of parts) for (let i = 0; i < p.pos.length; i += 3){
    p.pos[i]   = (p.pos[i]   - ctr[0]) * scale;
    p.pos[i+1] = (p.pos[i+1] - ctr[1]) * scale;
    p.pos[i+2] = (p.pos[i+2] - ctr[2]) * scale;
  }

  /* --- 压实：丢弃未被索引引用的顶点，并合并完全重合的顶点 ---
   * Kenney 的 GLB 每个 primitive 常带大量冗余顶点（1640 顶点 / 280 三角形），
   * 重建索引后通常能砍掉一半以上体积。 */
  for (const p of parts){
    const map = new Map();      // "x,y,z|nx,ny,nz" -> 新下标
    const npos = [], nnrm = [], nidx = [];
    const q = v => Math.round(v * 10000);   // 量化后再做 key，避免浮点噪声
    for (const oi of p.idx){
      const k = q(p.pos[oi*3]) + ',' + q(p.pos[oi*3+1]) + ',' + q(p.pos[oi*3+2]) + '|' +
                q(p.nrm[oi*3]) + ',' + q(p.nrm[oi*3+1]) + ',' + q(p.nrm[oi*3+2]);
      let ni = map.get(k);
      if (ni === undefined){
        ni = npos.length / 3;
        map.set(k, ni);
        npos.push(p.pos[oi*3], p.pos[oi*3+1], p.pos[oi*3+2]);
        nnrm.push(p.nrm[oi*3], p.nrm[oi*3+1], p.nrm[oi*3+2]);
      }
      nidx.push(ni);
    }
    p.pos = npos; p.nrm = nnrm; p.idx = nidx;
  }

  return {
    parts, bbox: { size: size.map(s => +(s * scale).toFixed(3)) },
    verts: parts.reduce((a, p) => a + p.pos.length / 3, 0),
    tris:  parts.reduce((a, p) => a + p.idx.length / 3, 0),
  };
}

/* ---------------- 序列化：Float32/Uint16 → base64 ---------------- */
const b64 = (typedArr) => Buffer.from(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength).toString('base64');
// 位置/法线量化成 Int16（±1 范围足够：模型已归一化到 ~1 单位），体积直接砍半
function quantF32(arr, range){
  const q = new Int16Array(arr.length);
  for (let i = 0; i < arr.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, arr[i] / range)) * 32767);
  return q;
}
function quantI8(arr){
  const q = new Int8Array(arr.length);
  for (let i = 0; i < arr.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, arr[i])) * 127);
  return q;
}

function serialize(name, baked, cfg){
  const parts = baked.parts.map(p => {
    const big = p.pos.length / 3 > 65535;
    const idx = big ? new Uint32Array(p.idx) : new Uint16Array(p.idx);
    return {
      c: p.color.map(v => +v.toFixed(4)),
      m: +p.metal.toFixed(2), r: +p.rough.toFixed(2),
      e: p.emis.some(v => v > 0.01) ? p.emis.map(v => +v.toFixed(3)) : 0,
      // 模型归一化后最长边 = cfg.size，坐标绝对值上界取 size 即可
      p: b64(quantF32(new Float32Array(p.pos), cfg.size)),
      // 法线只需 Int8：单位向量在 ±1 内，1/127 的精度对 Lambert 着色完全够用
      n: b64(quantI8(new Float32Array(p.nrm))),
      i: b64(idx), b: big ? 1 : 0,
    };
  });
  return { name, ps: cfg.size, parts };
}

/* ---------------- 配置 ----------------
 * rot: 修正模型自身朝向，目标是「船头指向 +Z」（与游戏里 group.rotation.y = yaw 约定一致）
 * size: 归一化后最长边的世界单位长度
 */
const K = 'kenney/Models/GLTF format/';
const JOBS = [
  // —— 玩家 / 僚机 ——
  { key: 'fighter',  file: K + 'craft_racer.glb',    size: 2.0, rot: [0, Math.PI, 0] },
  { key: 'wing_a',   file: K + 'craft_speederA.glb', size: 1.7, rot: [0, Math.PI, 0] },
  { key: 'wing_b',   file: K + 'craft_speederD.glb', size: 1.7, rot: [0, Math.PI, 0] },
  { key: 'hauler',   file: K + 'craft_cargoA.glb',   size: 2.1, rot: [0, Math.PI, 0] },
  // —— 5 种敌人 ——（不同体型/造型一眼可辨）
  { key: 'enemy_charger',  file: K + 'craft_speederB.glb', size: 1.5, rot: [0, Math.PI, 0] },
  { key: 'enemy_orbiter',  file: K + 'craft_speederC.glb', size: 1.5, rot: [0, Math.PI, 0] },
  { key: 'enemy_sniper',   file: K + 'craft_speederA.glb', size: 1.6, rot: [0, Math.PI, 0] },
  { key: 'enemy_splitter', file: K + 'craft_miner.glb',    size: 1.7, rot: [0, Math.PI, 0] },
  { key: 'enemy_brute',    file: K + 'craft_cargoB.glb',   size: 2.0, rot: [0, Math.PI, 0] },
  // —— BOSS 部件 ——
  { key: 'boss_core',  file: K + 'turret_single.glb',  size: 4.6, rot: [0, 0, 0] },
  { key: 'boss_arm',   file: K + 'turret_double.glb',  size: 3.2, rot: [0, 0, 0] },
  { key: 'boss_spine',  file: K + 'craft_cargoA.glb',  size: 5.5, rot: [0, Math.PI, 0] },
  // —— 武器专属模型（手写几何，见 tools/make_models.mjs）——
  { key: 'drone',  file: 'drone.glb',  size: 0.7, rot: [0, 0, 0] },
  { key: 'blade',  file: 'blade.glb',  size: 1.3, rot: [0, 0, 0] },
  // —— 新敌机模型（手写几何，见 tools/make_enemies.mjs）——
  { key: 'wasp',    file: 'wasp.glb',    size: 0.8,  rot: [0, 0, 0] },
  { key: 'mender',  file: 'mender.glb',  size: 1.05, rot: [0, 0, 0] },
  { key: 'phaser',  file: 'phaser.glb',  size: 0.95, rot: [0, 0, 0] },
];

const MESHES = {};
let totalBytes = 0;
for (const j of JOBS){
  const baked = bake(j.file, j);
  const ser   = serialize(j.key, baked, j);
  MESHES[j.key] = ser;
  const bytes = JSON.stringify(ser).length;
  totalBytes += bytes;
  console.log(`✓ ${j.key.padEnd(9)} ${j.file.padEnd(20)} ` +
              `parts=${baked.parts.length} verts=${baked.verts} tris=${baked.tris} ` +
              `bbox=[${baked.bbox.size.join(', ')}] → ${(bytes/1024).toFixed(0)}KB`);
  console.log(`   材质: ${baked.parts.map(p => p.name + '=' +
      p.color.map(v => Math.round(v*255)).join(',')).join('  ')}`);
}

const banner = `/**
 * 烘焙后的 3D 飞船网格（由 tools/bake_models.mjs 生成，请勿手改）
 *
 * 素材来源 / 授权：
 *   fighter — "SpaceShip" by akushal_hin        (Poly Pizza, CC-BY)
 *   hauler  — "Mining Spacecraft" by Kenney     (Poly Pizza, CC0)
 *
 * 格式：位置/法线量化为 Int16 后 base64；索引为 Uint16（b=0）或 Uint32（b=1）。
 *       解码见 index.html 的 Mesh.decode()。
 */
`;
fs.writeFileSync(OUT, banner + 'window.MESHES = ' + JSON.stringify(MESHES) + ';\n');
console.log(`\n→ ${path.relative(ROOT, OUT)}  ${(fs.statSync(OUT).size/1024).toFixed(0)}KB`);
