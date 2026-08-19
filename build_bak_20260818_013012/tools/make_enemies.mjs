/**
 * 手写几何 → GLB 生成器（零依赖）：3 种新敌机模型
 *
 * 目的：给"掠袭蜂 / 治愈者 / 折跃者"做真 3D 模型，替换原本只能复用飞船变体。
 *   - wasp.glb    : 高速蜂群近战（细长三角翼 + 前向螫针，+Z 朝前）
 *   - mender.glb  : 悬浮医疗无人机（六边舱体 + 顶部绿色发光核心）
 *   - phaser.glb  : 晶簇双锥体折跃幽灵（沿 Z 拉长，发光紫晶）
 * 法线由三角形顶点叉积现算，保证与发射顺序一致；运行时 Gfx.enemyShip 再叠加描边/尾焰。
 *
 * 输出：models_tmp/{wasp,mender,phaser}.glb  →  交给 bake_models.mjs 烘焙。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = path.join(ROOT, 'models_tmp');

/* ---------- 基础几何 ---------- */
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
function cyl(r, h, seg){
  const o = { pos: [], nrm: [], idx: [] };
  const y0 = -h/2, y1 = h/2;
  for (let i=0;i<seg;i++){
    const a0=(i/seg)*Math.PI*2, a1=((i+1)/seg)*Math.PI*2;
    const c0=Math.cos(a0), s0=Math.sin(a0), c1=Math.cos(a1), s1=Math.sin(a1);
    addQuad(o, [r*c0,y0,r*s0], [r*c1,y0,r*s1], [r*c1,y1,r*s1], [r*c0,y1,r*s0]);
  }
  const top=o.pos.length/3; o.pos.push(0,y1,0); o.nrm.push(0,1,0);
  for (let i=0;i<=seg;i++){ const a=(i/seg)*Math.PI*2; o.pos.push(r*Math.cos(a),y1,r*Math.sin(a)); o.nrm.push(0,1,0); }
  for (let i=1;i<=seg;i++) o.idx.push(top, top+i, top+i+1 < top+seg+1 ? top+i+1 : top+1);
  const bot=o.pos.length/3; o.pos.push(0,y0,0); o.nrm.push(0,-1,0);
  for (let i=0;i<=seg;i++){ const a=(i/seg)*Math.PI*2; o.pos.push(r*Math.cos(a),y0,r*Math.sin(a)); o.nrm.push(0,-1,0); }
  for (let i=1;i<=seg;i++) o.idx.push(bot, bot+i+1 < bot+seg+1 ? bot+i+1 : bot+1, bot+i);
  return o;
}
/** 锥体：基底在 z=-h/2 半径 r，尖端在 z=+h/2（朝 +Z，符合机头约定） */
function coneZ(r, h, seg){
  const o = { pos: [], nrm: [], idx: [] };
  const apex = [0,0,h/2];
  const ring = [];
  for (let i=0;i<seg;i++){ const a=(i/seg)*Math.PI*2; ring.push([r*Math.cos(a), r*Math.sin(a), -h/2]); }
  for (let i=0;i<seg;i++) addTri(o, ring[i], ring[(i+1)%seg], apex);
  // 底盖（-Z）
  const cap = o.pos.length/3; o.pos.push(0,0,-h/2); o.nrm.push(0,0,-1);
  for (let i=0;i<=seg;i++){ const a=(i/seg)*Math.PI*2; o.pos.push(r*Math.cos(a),-h/2,r*Math.sin(a)); o.nrm.push(0,0,-1); }
  for (let i=1;i<=seg;i++) o.idx.push(cap, cap+i+1 < cap+seg+1 ? cap+i+1 : cap+1, cap+i);
  return o;
}
/** 双锥体（晶簇）：中环在 z=0 半径 r，前后尖在 ±half */
function bipyramidZ(r, half, seg){
  const o = { pos: [], nrm: [], idx: [] };
  const af = [0,0, half], ab = [0,0,-half];
  const ring = [];
  for (let i=0;i<seg;i++){ const a=(i/seg)*Math.PI*2; ring.push([r*Math.cos(a), r*Math.sin(a), 0]); }
  for (let i=0;i<seg;i++){
    const j = (i+1)%seg;
    addTri(o, ring[i], ring[j], af);   // 前锥
    addTri(o, ring[j], ring[i], ab);   // 后锥
  }
  return o;
}

/* ---------- 变换 ---------- */
function rotateY(o, a){
  const c=Math.cos(a), s=Math.sin(a);
  for (let i=0;i<o.pos.length;i+=3){ const x=o.pos[i], z=o.pos[i+2]; o.pos[i]=x*c+z*s; o.pos[i+2]=-x*s+z*c;
    const nx=o.nrm[i], nz=o.nrm[i+2]; o.nrm[i]=nx*c+nz*s; o.nrm[i+2]=-nx*s+nz*c; }
}
function translate(o, x, y, z){ for (let i=0;i<o.pos.length;i+=3){ o.pos[i]+=x; o.pos[i+1]+=y; o.pos[i+2]+=z; } }
function merge(into, src){ const b=into.pos.length/3; for (let i=0;i<src.pos.length;i++){ into.pos.push(src.pos[i]); into.nrm.push(src.nrm[i]); } for (const k of src.idx) into.idx.push(k+b); }

/* ---------- 掠袭蜂 wasp（细长三角翼 + 前向螫针） ---------- */
function buildWasp(){
  const prims = [];
  // 细长机身（沿 Z）
  const body = box(0.18, 0.14, 0.55); prims.push({ geo: body, color:[0.70,0.72,0.78], metal:0.5, rough:0.5 });
  // 两片后掠三角翼
  let wl = box(0.42, 0.045, 0.22); rotateY(wl, 0.55);  translate(wl, 0.20, 0.0, -0.05);
  let wr = box(0.42, 0.045, 0.22); rotateY(wr, -0.55); translate(wr, -0.20, 0.0, -0.05);
  merge(wl, wr); prims.push({ geo: wl, color:[0.55,0.58,0.66], metal:0.5, rough:0.5 });
  // 前向螫针（尖端 +Z）
  const sting = coneZ(0.07, 0.30, 8); translate(sting, 0, 0, 0.40); prims.push({ geo: sting, color:[0.85,0.45,0.30], metal:0.3, rough:0.4, emissive:[0.25,0.10,0.05] });
  // 翼尖红点（敌意提示）
  for (const sx of [0.38, -0.38]){
    const tip = box(0.05,0.05,0.05); translate(tip, sx, 0.02, -0.12);
    prims.push({ geo: tip, color:[0.9,0.25,0.15], metal:0.1, rough:0.3, emissive:[0.4,0.08,0.04] });
  }
  return prims;
}

/* ---------- 治愈者 mender（六边悬浮舱 + 绿核心） ---------- */
function buildMender(){
  const prims = [];
  // 六边主舱（扁平）
  const hull = cyl(0.36, 0.18, 6); prims.push({ geo: hull, color:[0.62,0.68,0.72], metal:0.55, rough:0.45 });
  // 4 条支臂（±45°）
  const arms = { pos:[], nrm:[], idx:[] };
  for (const ang of [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4]){
    const arm = box(0.34, 0.05, 0.06);
    rotateY(arm, ang); translate(arm, Math.cos(ang)*0.22, 0.0, Math.sin(ang)*0.22);
    merge(arms, arm);
  }
  prims.push({ geo: arms, color:[0.42,0.46,0.52], metal:0.6, rough:0.5 });
  // 顶部中枢
  const hub = box(0.20, 0.12, 0.20); translate(hub, 0, 0.13, 0); prims.push({ geo: hub, color:[0.5,0.55,0.6], metal:0.5, rough:0.4 });
  // 绿色发光治疗核心（辨识 + 主题色）
  const core = box(0.16, 0.16, 0.16); translate(core, 0, 0.24, 0);
  prims.push({ geo: core, color:[0.35,0.95,0.45], metal:0.0, rough:0.3, emissive:[0.18,0.75,0.30] });
  return prims;
}

/* ---------- 折跃者 phaser（晶簇双锥体，发光紫） ---------- */
function buildPhaser(){
  const prims = [];
  // 主晶（沿 Z 拉长）
  const core = bipyramidZ(0.20, 0.52, 5);
  prims.push({ geo: core, color:[0.55,0.40,0.85], metal:0.2, rough:0.35, emissive:[0.22,0.10,0.40] });
  // 副晶（细、旋转 36°，增加晶体层叠感）
  const sub = bipyramidZ(0.11, 0.58, 4); rotateY(sub, Math.PI/4);
  prims.push({ geo: sub, color:[0.75,0.55,0.95], metal:0.2, rough:0.35, emissive:[0.30,0.15,0.50] });
  // 翼状薄片（×2，薄三角）
  const fin = { pos:[], nrm:[], idx:[] };
  for (const sz of [1, -1]){
    const f = box(0.36, 0.02, 0.20); translate(f, 0, 0, 0); rotateY(f, sz*0.4);
    merge(fin, f);
  }
  prims.push({ geo: fin, color:[0.45,0.32,0.70], metal:0.25, rough:0.4, emissive:[0.15,0.08,0.30] });
  return prims;
}

/* ---------- 写 GLB（与 make_models.mjs 同款容器） ---------- */
function writeGLB(primitives, outPath){
  const binParts = []; let offset = 0;
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
      if(x<minx)minx=x; if(y<miny)miny=y; if(z<minz)minz=z; if(x>maxx)maxx=x; if(y>maxy)maxy=y; if(z>maxz)maxz=z; }
    accessors.push({ bufferView:pV, componentType:5126, count:pos.length/3, type:'VEC3', min:[minx,miny,minz], max:[maxx,maxy,maxz] });
    accessors.push({ bufferView:nV, componentType:5126, count:nrm.length/3, type:'VEC3' });
    accessors.push({ bufferView:iV, componentType:5123, count:idx.length, type:'SCALAR' });
    const mat = { pbrMetallicRoughness:{ baseColorFactor:[p.color[0],p.color[1],p.color[2],1], metallicFactor:p.metal, roughnessFactor:p.rough } };
    if (p.emissive) mat.emissiveFactor = p.emissive;
    materials.push(mat);
    p._a = [accessors.length-3, accessors.length-2, accessors.length-1]; p._m = materials.length-1;
  }
  const gltf = {
    asset:{ version:'2.0', generator:'make_enemies' }, scene:0, scenes:[{ nodes:[0] }], nodes:[{ mesh:0 }],
    meshes:[{ primitives: primitives.map(p => ({ attributes:{ POSITION:p._a[0], NORMAL:p._a[1] }, indices:p._a[2], material:p._m, mode:4 })) }],
    materials, accessors, bufferViews, buffers:[{ byteLength: offset }],
  };
  const jsonBuf = Buffer.from(JSON.stringify(gltf), 'utf8');
  const jp = (4 - (jsonBuf.length % 4)) % 4; const jsonP = Buffer.concat([jsonBuf, Buffer.alloc(jp, 0x20)]);
  const binBuf = Buffer.concat(binParts);
  const bp = (4 - (binBuf.length % 4)) % 4; const binP = bp ? Buffer.concat([binBuf, Buffer.alloc(bp)]) : binBuf;
  const total = 12 + 8 + jsonP.length + 8 + binP.length;
  const hdr = Buffer.alloc(12); hdr.writeUInt32LE(0x46546C67,0); hdr.writeUInt32LE(2,4); hdr.writeUInt32LE(total,8);
  const c0 = Buffer.alloc(8); c0.writeUInt32LE(jsonP.length,0); c0.writeUInt32LE(0x4E4F534A,4);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(binP.length,0); c1.writeUInt32LE(0x004E4942,4);
  fs.writeFileSync(outPath, Buffer.concat([hdr, c0, jsonP, c1, binP]));
  console.log(`✓ ${path.basename(outPath)}  prims=${primitives.length} ` +
    `verts=${primitives.reduce((a,p)=>a+p.geo.pos.length/3,0)} ` +
    `tris=${primitives.reduce((a,p)=>a+p.geo.idx.length/3,0)} → ${(fs.statSync(outPath).size/1024).toFixed(1)}KB`);
}

writeGLB(buildWasp(),    path.join(OUT, 'wasp.glb'));
writeGLB(buildMender(),  path.join(OUT, 'mender.glb'));
writeGLB(buildPhaser(),  path.join(OUT, 'phaser.glb'));
console.log('→ 已生成 wasp/mender/phaser.glb，请运行 tools/bake_models.mjs');
