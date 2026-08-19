import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseGLB(buf){
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = dv.getUint32(0, true);
  if (magic !== 0x46546C67) throw new Error('not glb');
  const total = dv.getUint32(8, true);
  let off = 12, json = null, bin = null;
  while (off < total){
    const len = dv.getUint32(off, true), type = dv.getUint32(off+4, true);
    const data = buf.subarray(off+8, off+8+len);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data));
    else if (type === 0x004E4942) bin = data;
    off += 8 + len + ((4 - (len % 4)) % 4 === 4 ? 0 : 0);
    off = off + 0; // chunks are 4-byte aligned already by len padding
  }
  return { json, bin };
}

for (const f of ['pp_kenney.glb','pp_spaceship.glb','pp_rocket.glb','sb_ship.glb']){
  const p = path.join(ROOT, 'models_tmp', f);
  if (!fs.existsSync(p)) { console.log(f, 'MISSING'); continue; }
  const buf = fs.readFileSync(p);
  try {
    const { json, bin } = parseGLB(buf);
    const g = json;
    let prims = 0, tris = 0, verts = 0;
    (g.meshes||[]).forEach(m => m.primitives.forEach(pr => {
      prims++;
      const pa = g.accessors[pr.attributes.POSITION]; verts += pa.count;
      if (pr.indices != null) tris += g.accessors[pr.indices].count/3;
    }));
    console.log('=== ' + f + ' (' + (buf.length/1024).toFixed(0) + 'KB) ===');
    console.log('  ext:', JSON.stringify(g.extensionsUsed||[]));
    console.log('  nodes:', (g.nodes||[]).length, 'meshes:', (g.meshes||[]).length,
                'prims:', prims, 'verts:', verts, 'tris:', tris);
    console.log('  materials:', (g.materials||[]).length,
                (g.materials||[]).slice(0,8).map(m => (m.name||'?') + ':' +
                  JSON.stringify((m.pbrMetallicRoughness||{}).baseColorFactor||null)).join(' '));
    console.log('  images:', (g.images||[]).length, 'attrs:',
                JSON.stringify([...new Set((g.meshes||[]).flatMap(m=>m.primitives.flatMap(p=>Object.keys(p.attributes))))]));
    console.log('  skins:', (g.skins||[]).length, 'anims:', (g.animations||[]).length);
  } catch(e){ console.log(f, 'ERR', e.message); }
}
