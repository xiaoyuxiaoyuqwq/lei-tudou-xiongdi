/**
 * 手写几何 → GLB 生成器（零依赖）
 *
 * 目的：给「无人僚机」和「环绕光刃」做真 3D 模型，替换原本的 ConeGeometry 原始体。
 *   - drone.glb : 四旋翼侦察无人机（机身 + 交叉机臂 + 4 旋翼 + 传感眼）
 *   - blade.glb : 沿 +Z 的锥形双刃光刃（护手 + 发射座）
 * 法线由三角形顶点叉积现算，保证与发射顺序一致；运行时再叠加描边/导航灯/辉光。
 *
 * 输出：models_tmp/drone.glb , models_tmp/blade.glb  →  交给 bake_models.mjs 烘焙。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, 'models_tmp');

/* ---------- 基础几何（写入 {pos,nrm,idx} 普通数组） ---------- */
function addTri(o, a, b, c){
  const ux = b[0]-a[0], uy = b[1]-a[1], uz = b[2]-a[2];
  const vx = c[0]-a[0], vy = c[1]-a[1], vz = c[2]-a[2];
  let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
  const L = Math.hypot(nx, ny, nz) || 1; nx/=L; ny/=L; nz/=L;
  const base = o.pos.length/3;
  o.pos.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]);
  o.nrm.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
  o.idx.push(base, base+1, base+2);
}
function addQuad(o, a, b, c, d){ addTri(o, a, b, c); addTri(o, a, c, d); }

function box(w, h, d){
  const x = w/2, y = h/2, z = d/2;
  const o = { pos: [], nrm: [], idx: [] };
  // 六个面，顶点序 = 自外侧看 CCW（与 three BoxGeometry 一致）
  const faces = [
    { n:[1,0,0],  v:[[x,-y,-z],[x,y,-z],[x,y,z],[x,-y,z]] },
    { n:[-1,0,0], v:[[-x,-y,z],[-x,y,z],[-x,y,-z],[-x,-y,-z]] },
    { n:[0,1,0],  v:[[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]] },
    { n:[0,-1,0], v:[[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]] },
    { n:[0,0,1],  v:[[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]] },
    { n:[0,0,-1], v:[[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]] },
  ];
  for (const f of faces){
    const base = o.pos.length/3;
    for (const v of f.v) o.pos.push(v[0],v[1],v[2]);
    for (let i=0;i<4;i++) o.nrm.push(f.n[0],f.n[1],f.n[2]);
    o.idx.push(base, base+1, base+2, base, base+2, base+3);
  }
  return o;
}

// 圆柱，轴 = Y；seg 段；含侧壁 + 上下盖
function cyl(r, h, seg){
  const o = { pos: [], nrm: [], idx: [] };
  const y0 = -h/2, y1 = h/2;
  for (let i=0;i<seg;i++){
    const a0 = (i/seg)*Math.PI*2, a1 = ((i+1)/seg)*Math.PI*2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const b0 = [r*c0, y0, r*s0], b1 = [r*c1, y0, r*s1];
    const t1 = [r*c1, y1, r*s1], t0 = [r*c0, y1, r*s0];
    addQuad(o, b0, b1, t1, t0);   // 侧壁（法线近似径向）
    // 覆盖法线：侧壁法线应为径向；上面 addQuad 用叉积，近似 OK
  }
  // 顶盖（+Y）
  const top = o.pos.length/3;
  o.pos.push(0, y1, 0); o.nrm.push(0,1,0);
  for (let i=0;i<=seg;i++){ const a=(i/seg)*Math.PI*2; o.pos.push(r*Math.cos(a), y1, r*Math.sin(a)); o.nrm.push(0,1,0); }
  for (let i=1;i<=seg;i++) o.idx.push(top, top+i, top+i+1 < top+seg+1 ? top+i+1 : top+1);
  // 底盖（-Y）
  const bot = o.pos.length/3;
  o.pos.push(0, y0, 0); o.nrm.push(0,-1,0);
  for (let i=0;i<=seg;i++){ const a=(i/seg)*Math.PI*2; o.pos.push(r*Math.cos(a), y0, r*Math.sin(a)); o.nrm.push(0,-1,0); }
  for (let i=1;i<=seg;i++) o.idx.push(bot, bot+i+1 < bot+seg+1 ? bot+i+1 : bot+1, bot+i);
  return o;
}

/* ---------- 变换（就地） ---------- */
function rotateY(o, a){
  const c = Math.cos(a), s = Math.sin(a);
  for (let i=0;i<o.pos.length;i+=3){
    const x=o.pos[i], z=o.pos[i+2];
    o.pos[i]   = x*c + z*s;
    o.pos[i+2] = -x*s + z*c;
    const nx=o.nrm[i], nz=o.nrm[i+2];
    o.nrm[i]   = nx*c + nz*s;
    o.nrm[i+2] = -nx*s + nz*c;
  }
}
function translate(o, x, y, z){
  for (let i=0;i<o.pos.length;i+=3){ o.pos[i]+=x; o.pos[i+1]+=y; o.pos[i+2]+=z; }
}
function merge(into, src){ const b = into.pos.length/3; for (let i=0;i<src.pos.length;i++){ into.pos.push(src.pos[i]); into.nrm.push(src.nrm[i]); } for (const k of src.idx) into.idx.push(k+b); }

/* ---------- 无人机：机身 + 交叉机臂 + 4 旋翼 + 传感眼 ---------- */
function buildDrone(){
  const prims = [];
  // 机身（浅金属灰）
  const body = box(0.42, 0.20, 0.50);
  prims.push({ geo: body, color: [0.82,0.85,0.90], metal: 0.5, rough: 0.5 });
  // 交叉机臂（深框色），±45° 绕 Y
  const armA = box(0.70, 0.07, 0.09); rotateY(armA,  Math.PI/4);
  const armB = box(0.70, 0.07, 0.09); rotateY(armB, -Math.PI/4);
  merge(armA, armB);
  prims.push({ geo: armA, color: [0.40,0.43,0.48], metal: 0.6, rough: 0.5 });
  // 4 旋翼（暗色）：机座 + 桨叶
  const rotor = { pos: [], nrm: [], idx: [] };
  for (const [px, pz] of [[0.248,0.248],[-0.248,0.248],[0.248,-0.248],[-0.248,-0.248]]){
    const house = cyl(0.14, 0.05, 10); translate(house, px, 0.03, pz); merge(rotor, house);
    const blade = box(0.30, 0.025, 0.05); translate(blade, px, 0.07, pz); rotateY(blade, px*pz>0 ? 0.5 : -0.5); merge(rotor, blade);
  }
  prims.push({ geo: rotor, color: [0.22,0.24,0.28], metal: 0.4, rough: 0.6 });
  // 传感眼（发光青）
  const eye = box(0.13, 0.11, 0.13); translate(eye, 0, 0.15, 0.10);
  prims.push({ geo: eye, color: [0.55,0.95,1.0], metal: 0.1, rough: 0.3, emissive: [0.2,0.55,0.65] });
  return prims;
}

/* ---------- 光刃：沿 +Z 的锥形双刃 + 护手 + 发射座 ---------- */
function buildBlade(){
  const o = { pos: [], nrm: [], idx: [] };
  const L = 1.3, hw = 0.16, ht = 0.05, seg = 14;
  const z0 = -L/2, z1 = L/2;
  const rings = [];
  for (let i=0;i<=seg;i++){
    const t = i/seg;
    const z = z0 + (z1-z0)*t;
    const w = 1 - t*0.9;                 // 向尖端收拢
    const ww = hw*w, hh = ht*w;
    rings.push([ [ww,0,z], [0,hh,z], [-ww,0,z], [0,-hh,z] ]);
  }
  for (let i=0;i<seg;i++){
    const A = rings[i], B = rings[i+1];
    addQuad(o, A[0], B[0], B[1], A[1]);   // 前刃面
    addQuad(o, A[1], B[1], B[2], A[2]);   // 背脊面
    addQuad(o, A[2], B[2], B[3], A[3]);   // 后刃面
    addQuad(o, A[3], B[3], B[0], A[0]);   // 腹面
  }
  const last = rings[seg], apex = [0,0,z1];
  addTri(o, last[0], last[1], apex); addTri(o, last[1], last[2], apex);
  addTri(o, last[2], last[3], apex); addTri(o, last[3], last[0], apex);
  const first = rings[0];
  addTri(o, first[0], first[3], first[2]); addTri(o, first[0], first[2], first[1]);
  // 护手
  const g = box(0.34, 0.045, 0.09); translate(g, 0, 0, z0+0.05); merge(o, g);
  // 发射座
  const e = box(0.13, 0.15, 0.13); translate(e, 0, 0, z0-0.07); merge(o, e);
  return [{ geo: o, color: [0.30,0.80,1.0], metal: 0.0, rough: 0.4, emissive: [0.15,0.55,0.85] }];
}

/* ---------- 写 GLB ---------- */
function writeGLB(primitives, outPath){
  const binParts = [];
  let offset = 0;
  const align4 = () => { const p = (4 - (offset % 4)) % 4; if (p){ binParts.push(Buffer.alloc(p)); offset += p; } };
  const bufferViews = [], accessors = [], materials = [];
  for (const p of primitives){
    const pos = new Float32Array(p.geo.pos);
    const nrm = new Float32Array(p.geo.nrm);
    const idx = new Uint16Array(p.geo.idx);
    align4(); const pV = bufferViews.length;
    binParts.push(Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength)); offset += pos.byteLength;
    bufferViews.push({ buffer:0, byteOffset: offset - pos.byteLength, byteLength: pos.byteLength, target: 34962 });
    align4(); const nV = bufferViews.length;
    binParts.push(Buffer.from(nrm.buffer, nrm.byteOffset, nrm.byteLength)); offset += nrm.byteLength;
    bufferViews.push({ buffer:0, byteOffset: offset - nrm.byteLength, byteLength: nrm.byteLength, target: 34962 });
    align4(); const iV = bufferViews.length;
    binParts.push(Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength)); offset += idx.byteLength;
    bufferViews.push({ buffer:0, byteOffset: offset - idx.byteLength, byteLength: idx.byteLength, target: 34963 });

    let minx=1e9,miny=1e9,minz=1e9,maxx=-1e9,maxy=-1e9,maxz=-1e9;
    for (let i=0;i<pos.length;i+=3){ const x=pos[i],y=pos[i+1],z=pos[i+2];
      if(x<minx)minx=x; if(y<miny)miny=y; if(z<minz)minz=z;
      if(x>maxx)maxx=x; if(y>maxy)maxy=y; if(z>maxz)maxz=z; }
    accessors.push({ bufferView:pV, componentType:5126, count:pos.length/3, type:'VEC3', min:[minx,miny,minz], max:[maxx,maxy,maxz] });
    accessors.push({ bufferView:nV, componentType:5126, count:nrm.length/3, type:'VEC3' });
    accessors.push({ bufferView:iV, componentType:5123, count:idx.length, type:'SCALAR' });

    const mat = { pbrMetallicRoughness:{ baseColorFactor:[p.color[0],p.color[1],p.color[2],1], metallicFactor:p.metal, roughnessFactor:p.rough } };
    if (p.emissive) mat.emissiveFactor = p.emissive;
    materials.push(mat);
    p._a = [accessors.length-3, accessors.length-2, accessors.length-1];
    p._m = materials.length-1;
  }
  const gltf = {
    asset:{ version:'2.0', generator:'make_models' }, scene:0, scenes:[{ nodes:[0] }], nodes:[{ mesh:0 }],
    meshes:[{ primitives: primitives.map(p => ({ attributes:{ POSITION:p._a[0], NORMAL:p._a[1] }, indices:p._a[2], material:p._m, mode:4 })) }],
    materials, accessors, bufferViews, buffers:[{ byteLength: offset }],
  };
  const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jp = (4 - (jsonBuf.length % 4)) % 4;
  const jsonP = Buffer.concat([jsonBuf, Buffer.alloc(jp, 0x20)]);
  const binBuf = Buffer.concat(binParts);
  const bp = (4 - (binBuf.length % 4)) % 4;
  const binP = bp ? Buffer.concat([binBuf, Buffer.alloc(bp)]) : binBuf;
  const total = 12 + 8 + jsonP.length + 8 + binP.length;
  const hdr = Buffer.alloc(12);
  hdr.writeUInt32LE(0x46546C67, 0); hdr.writeUInt32LE(2, 4); hdr.writeUInt32LE(total, 8);
  const c0 = Buffer.alloc(8); c0.writeUInt32LE(jsonP.length, 0); c0.writeUInt32LE(0x4E4F534A, 4);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(binP.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(outPath, Buffer.concat([hdr, c0, jsonP, c1, binP]));
  console.log(`✓ ${path.basename(outPath)}  primitives=${primitives.length} ` +
    `verts=${primitives.reduce((a,p)=>a+p.geo.pos.length/3,0)} ` +
    `tris=${primitives.reduce((a,p)=>a+p.geo.idx.length/3,0)} → ${(fs.statSync(outPath).size/1024).toFixed(1)}KB`);
}

writeGLB(buildDrone(), path.join(OUT, 'drone.glb'));
writeGLB(buildBlade(), path.join(OUT, 'blade.glb'));
console.log('→ 已生成 drone.glb / blade.glb，请运行 tools/bake_models.mjs');
