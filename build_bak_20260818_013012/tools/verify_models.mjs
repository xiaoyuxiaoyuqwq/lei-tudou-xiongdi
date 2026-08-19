/**
 * 专项验证：无人僚机 + 环绕光刃 真 3D 建模（替换原始 ConeGeometry）
 * 用法：node tools/verify_models.mjs
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const pass = [], fail = [];
const ok  = (n, d) => pass.push(n + (d ? ' — ' + d : ''));
const bad = (n, d) => fail.push(n + (d ? ' — ' + d : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(1500);

// ---- 0. 模型数据已烘焙进 meshes.js（drone/blade 存在且含几何）----
const def = await page.evaluate(() => ({
  drone: !!(MESHES.drone && MESHES.drone.parts.length === 4 && MESHES.drone.parts[0].p),
  blade: !!(MESHES.blade && MESHES.blade.parts.length >= 1 && MESHES.blade.parts[0].p),
}));
(def.drone && def.blade) ? ok('模型已烘焙', 'drone(4 部件) / blade 进入 meshes.js')
                         : bad('模型已烘焙', JSON.stringify(def));

// ---- 1. 无人机是真 3D Group：多网格 + 反向描边 + 导航灯 + 微推进器 ----
const drone = await page.evaluate(() => {
  Game.start(false);
  const d = Weapons.drones[0].mesh;
  let meshCount = 0, vertTotal = 0, hasOutline = false, hasNav = false, hasThr = false;
  d.traverse(o => {
    if (o.isMesh){
      meshCount++;
      const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (pos) vertTotal += pos.count;
      if (o.material && o.material.side === THREE.BackSide) hasOutline = true;
      if (o.material && o.material.blending === THREE.AdditiveBlending &&
          o.geometry && o.geometry.type === 'SphereGeometry') hasNav = true;
    }
    if (o.isGroup && o.children.some(c => c.userData && c.userData.cone)) hasThr = true;
  });
  return { isGroup: d.isGroup, children: d.children.length, meshCount, vertTotal, hasOutline, hasNav, hasThr };
});
(drone.isGroup && drone.meshCount >= 5 && drone.vertTotal > 100 && drone.hasOutline && drone.hasNav && drone.hasThr)
  ? ok('无人机建模', `Group(${drone.children}子节点)/${drone.meshCount}网格/${drone.vertTotal}顶点，含描边+导航灯+推进器`)
  : bad('无人机建模', JSON.stringify(drone));

// ---- 2. 光刃是真 3D 双刃模型（BufferGeometry，非 ConeGeometry，加法辉光）----
const blade = await page.evaluate(() => {
  Game.start(false);
  const b = Weapons.blades[0].mesh;
  const v = (b.geometry && b.geometry.attributes && b.geometry.attributes.position)
    ? b.geometry.attributes.position.count : 0;
  return {
    isMesh: b.isMesh,
    type: b.geometry ? b.geometry.type : null,
    verts: v,
    additive: !!(b.material && b.material.blending === THREE.AdditiveBlending),
  };
});
(blade.isMesh && blade.type === 'BufferGeometry' && blade.verts > 100 && blade.additive)
  ? ok('光刃建模', `BufferGeometry ${blade.verts} 顶点（非圆锥），加法青色辉光`)
  : bad('光刃建模', JSON.stringify(blade));

// ---- 3. 实战：同时持有时无人机与光刃环绕飞行、可见 ----
const live = await page.evaluate(async () => {
  Game.start(false);
  Progress.weapons = { drone: 3, orbit: 3 };
  Weapons.cd.drone = -1; Weapons.cd.orbit = -1;
  Enemies.clear();
  const p0d = Weapons.drones.map(d => ({ x: d.mesh.position.x, z: d.mesh.position.z }));
  const p0b = Weapons.blades.map(b => ({ x: b.mesh.position.x, z: b.mesh.position.z }));
  let dVis = false, bVis = false;
  for (let i = 0; i < 60; i++){
    await new Promise(r => requestAnimationFrame(r));
    if (Weapons.drones.some(d => d.mesh.visible)) dVis = true;
    if (Weapons.blades.some(b => b.mesh.visible)) bVis = true;
  }
  const dMoved = Weapons.drones.some((d, i) => Math.hypot(d.mesh.position.x - p0d[i].x, d.mesh.position.z - p0d[i].z) > 0.3);
  const bMoved = Weapons.blades.some((b, i) => Math.hypot(b.mesh.position.x - p0b[i].x, b.mesh.position.z - p0b[i].z) > 0.3);
  return { dVis, bVis, dMoved, bMoved, nD: Weapons.drones.length, nB: Weapons.blades.length };
});
(live.dVis && live.bVis && live.dMoved && live.bMoved && live.nD === 5 && live.nB === 5)
  ? ok('实战环绕', `5 无人机 + 5 光刃 可见并环绕飞行`)
  : bad('实战环绕', JSON.stringify(live));

// ---- 4. 零控制台报错 ----
errors.length === 0 ? ok('控制台零报错', errors.length + ' 条')
                     : bad('控制台零报错', errors.slice(0, 3).join(' | '));

await browser.close();
console.log('\n==== 无人机 / 光刃 建模专项验证 ====');
pass.forEach(p => console.log('  [PASS] ' + p));
fail.forEach(f => console.log('  [FAIL] ' + f));
console.log(`通过 ${pass.length} / 失败 ${fail.length}`);
process.exit(fail.length ? 1 : 0);
