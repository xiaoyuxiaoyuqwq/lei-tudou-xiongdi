/**
 * 进一步优化 专项自检
 * 用法：node tools/verify_further.mjs
 * 覆盖：敌人 cel 描边 / 地面扫描波旋转 / 背景彗星漂移 / BOSS 外环+卫星舱 / 弹道拖尾(粒子活跃) / 零报错
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const pass = [], fail = [];
const ok  = (n, d) => pass.push(n + (d ? ' — ' + d : ''));
const bad = (n, d) => fail.push(n + (d ? ' — ' + d : ''));

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
await new Promise(r => setTimeout(r, 2200));
await page.click('#btnStart');
await new Promise(r => setTimeout(r, 1800));

// 1) 敌人 cel 描边：spawn 一个敌人，检查其 Group 是否含 BackSide 描边 mesh
const enemyOutline = await page.evaluate(() => {
  const e = Enemies.spawn('charger', 6, 6, 1, 1, 1, false);
  if (!e || !e.mesh) return -1;
  let n = 0;
  e.mesh.traverse(c => {
    if (c.isMesh && c.material && c.material.side === THREE.BackSide) n++;
  });
  return n;
});
enemyOutline > 0 ? ok('敌人反向外壳描边', enemyOutline + ' 个 BackSide 外壳') : bad('敌人反向外壳描边', '未检测到描边 mesh');

// 2) 地面扫描波：存在且随时间旋转
const scanBefore = await page.evaluate(() => (World.scan ? World.scan.rotation.z : null));
await new Promise(r => setTimeout(r, 600));
const scanAfter = await page.evaluate(() => (World.scan ? World.scan.rotation.z : null));
(scanBefore != null && scanAfter != null && Math.abs(scanAfter - scanBefore) > 0.05)
  ? ok('地面扫描波旋转', 'Δz=' + (scanAfter - scanBefore).toFixed(3))
  : bad('地面扫描波旋转', 'scan 未旋转');

// 3) 背景彗星流：6 条且随时间漂移
const comet = await page.evaluate(() => {
  if (!World.comets || World.comets.length !== 6) return { n: World.comets ? World.comets.length : 0 };
  const c0 = World.comets[0];
  return { n: 6, x: c0.position.x, z: c0.position.z };
});
await new Promise(r => setTimeout(r, 600));
const comet2 = await page.evaluate(() => World.comets && World.comets[0]
  ? { x: World.comets[0].position.x, z: World.comets[0].position.z } : null);
(comet.n === 6 && comet2 && Math.hypot(comet2.x - comet.x, comet2.z - comet.z) > 0.1)
  ? ok('背景彗星流漂移', '6 条 · 位移 ' + Math.hypot(comet2.x - comet.x, comet2.z - comet.z).toFixed(2))
  : bad('背景彗星流漂移', '彗星未漂移或数量异常=' + comet.n);

// 4) BOSS 更威严：外环 + 3 颗卫星舱
await page.evaluate(() => { Boss.spawn(); Boss.entering = false; Player.hp = 1e9; Player.inv = 1e9; });
await new Promise(r => setTimeout(r, 450));
const bossMaj = await page.evaluate(() => {
  const u = Boss.g.userData;
  return { outer: !!u.outerHalo, pods: u.pods ? u.pods.length : 0 };
});
(bossMaj.outer && bossMaj.pods === 3)
  ? ok('BOSS 外环+卫星舱', '外环 ✔ · 卫星舱 ' + bossMaj.pods + ' 颗')
  : bad('BOSS 外环+卫星舱', JSON.stringify(bossMaj));
// 卫星舱公转：位置随时间变化
const podA = await page.evaluate(() => { const p = Boss.g.userData.pods[0].position; return { x: p.x, y: p.y, z: p.z }; });
await new Promise(r => setTimeout(r, 500));
const podB = await page.evaluate(() => { const p = Boss.g.userData.pods[0].position; return { x: p.x, y: p.y, z: p.z }; });
const podD = podA && podB ? Math.hypot(podB.x - podA.x, podB.y - podA.y, podB.z - podA.z) : 0;
(podD > 0.05)
  ? ok('卫星舱公转', '位移 ' + podD.toFixed(2))
  : bad('卫星舱公转', '卫星舱未动');
await page.evaluate(() => Boss.clear());

// 5) 弹道发光拖尾：战斗中 FX 粒子池应被激活（子弹拖尾持续产生粒子）
await new Promise(r => setTimeout(r, 1200));
const fxActive = await page.evaluate(() => FX.pool.active.length);
fxActive > 0 ? ok('弹道拖尾(粒子活跃)', 'FX.active=' + fxActive) : bad('弹道拖尾(粒子活跃)', '无活跃粒子');

// 6) 零控制台报错
errors.length === 0 ? ok('控制台零报错', errors.length + ' 条') : bad('控制台零报错', errors.slice(0, 3).join(' | '));

console.log('\n=== 进一步优化 专项自检 ===');
pass.forEach(p => console.log('  [PASS] ' + p));
fail.forEach(f => console.log('  [FAIL] ' + f));
console.log('==========================================');
console.log(`通过 ${pass.length} / 失败 ${fail.length}`);
await browser.close();
process.exit(fail.length ? 1 : 0);
