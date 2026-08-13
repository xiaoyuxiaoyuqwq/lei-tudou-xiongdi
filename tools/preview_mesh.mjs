/** 把烘焙好的网格投影成 ASCII 视图，用来肉眼确认朝向 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'assets', 'meshes.js'), 'utf8');
const MESHES = JSON.parse(src.slice(src.indexOf('window.MESHES = ') + 16, src.lastIndexOf(';')));

const deq = (b64, range) => {
  const b = Buffer.from(b64, 'base64');
  const q = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
  const f = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) f[i] = q[i] / 32767 * range;
  return f;
};

function render(name, M, ax, ay, W, H, labelX, labelY){
  const pts = [];
  for (const p of M.parts){
    const P = deq(p.p, M.ps);
    for (let i = 0; i < P.length; i += 3) pts.push([P[i], P[i+1], P[i+2]]);
  }
  let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
  for (const v of pts){
    if (v[ax] < mnx) mnx = v[ax];
    if (v[ax] > mxx) mxx = v[ax];
    if (v[ay] < mny) mny = v[ay];
    if (v[ay] > mxy) mxy = v[ay];
  }
  const grid = Array.from({ length: H }, () => Array(W).fill(' '));
  for (const v of pts){
    const cx = Math.round((v[ax] - mnx) / (mxx - mnx || 1) * (W - 1));
    const cy = Math.round((1 - (v[ay] - mny) / (mxy - mny || 1)) * (H - 1));
    grid[cy][cx] = '#';
  }
  const rx = mnx.toFixed(2) + '~' + mxx.toFixed(2);
  const ry = mny.toFixed(2) + '~' + mxy.toFixed(2);
  console.log('\n-- ' + name + '   横=' + labelX + '(' + rx + ')   纵=' + labelY + '(' + ry + ') --');
  grid.forEach((r, i) => {
    console.log('  |' + r.join('') + '|' + (i === 0 ? '   <= ' + labelY + '+ 这一侧' : ''));
  });
}

for (const [k, M] of Object.entries(MESHES)){
  render(k + ' 俯视', M, 0, 2, 56, 22, 'X', 'Z');
  render(k + ' 侧视', M, 2, 1, 56, 12, 'Z', 'Y');
}
