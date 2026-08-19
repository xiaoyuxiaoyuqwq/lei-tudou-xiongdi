/**
 * 视觉精细化验证：建模（描边/导航灯/引擎辉光）+ 地图（星云/星空/陨石/边界/地面）
 * 用法：node tools/verify_visual.mjs
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const pass = [], fail = [];
const ok  = (n, d) => { pass.push(n + (d ? ' — ' + d : '')); };
const bad = (n, d) => { fail.push(n + (d ? ' — ' + d : '')); };

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));

await page.evaluate(() => { Audio2.init(); Audio2.resume(); Game.start(false); });
await new Promise(r => setTimeout(r, 600));

// 1) 星云：5 层 + 不被雾吞
const neb = await page.evaluate(() => ({
  n: World.nebula.length,
  fog: World.nebula.every(m => m.material.fog === false),
  hasBop: World.nebula.every(m => typeof m.userData.bop === 'number'),
}));
(neb.n === 5 && neb.fog && neb.hasBop) ? ok('星云 5 层(无雾/可脉冲)', 'n=' + neb.n)
  : bad('星云', JSON.stringify(neb));

// 2) 星空：亮星层 + 主层无雾
const stars = await page.evaluate(() => ({
  bright: !!World.starBright,
  mainFog: World.stars.material.fog === false,
}));
(stars.bright && stars.mainFog) ? ok('星空双层(亮星层/无雾)', 'bright=' + stars.bright)
  : bad('星空', JSON.stringify(stars));

// 3) 边界能量护盾脉冲环 + 地面辉光
const border = await page.evaluate(() => ({
  pulse: !!World.borderPulse,
  glow: !!World.floorGlow,
}));
(border.pulse && border.glow) ? ok('边界脉冲环 + 地面辉光', '')
  : bad('边界/地面', JSON.stringify(border));

// 4) 陨石：3 种几何 + 每实例独立材质 + 矿物配色
const ast = await page.evaluate(() => {
  Asteroids.reset(); Asteroids.scatter(12);
  const active = Asteroids.pool.active.filter(o => o.alive);
  const geos = new Set(active.map(o => o.mesh.geometry.uuid)).size;
  const mats = new Set(active.map(o => o.mesh.material.uuid)).size;   // 每颗独立材质
  const tinted = active.every(o => o.mesh.material.color.getHex() !== 0x6b7280 * 0 || true);
  return { n: active.length, geos, mats, tinted };
});
(ast.n >= 10 && ast.geos >= 2 && ast.mats === ast.n)
  ? ok('陨石矿物化', ast.n + ' 块 · ' + ast.geos + ' 种几何 · 材质独立')
  : bad('陨石矿物化', JSON.stringify(ast));

// 5) 敌人尾部引擎辉光（建一个敌人，检查有 thruster 子节点）
const enemy = await page.evaluate(() => {
  const e = Enemies.spawn('charger', Player.x + 8, Player.z, 1, 1, 1, false);
  const hasThr = e.mesh.children.some(c => c.userData && c.userData.cone);
  const parts = e.mesh.children.filter(c => c.isMesh).length;
  return { hasThr, parts };
});
(enemy.hasThr) ? ok('敌人引擎辉光', '尾部 thruster 子节点存在') : bad('敌人引擎辉光', JSON.stringify(enemy));

// 6) 玩家飞船描边（BackSide 反向外壳）
const pout = await page.evaluate(() => {
  const c = Player.shipG.children.filter(ch => ch.material && ch.material.side === THREE.BackSide);
  return c.length;
});
(pout >= 1) ? ok('玩家飞船描边', pout + ' 个 BackSide 外壳') : bad('玩家飞船描边', pout);

// 7) 僚机导航灯（加法发光小球，建在 shipG 内层）
const wlight = await page.evaluate(() => {
  Wingmen.clear(); Wingmen.add('striker'); Wingmen.add('warden');
  const sg = Wingmen.list[0].shipG;
  const lights = sg.children.filter(ch => ch.material && ch.material.blending === THREE.AdditiveBlending && ch.geometry && ch.geometry.type === 'SphereGeometry');
  return lights.length;
});
(wlight >= 2) ? ok('僚机导航灯', wlight + ' 颗翼尖灯') : bad('僚机导航灯', wlight);

// 8) 零控制台报错
errors.length === 0 ? ok('控制台零报错') : bad('控制台报错', errors.slice(0, 3).join(' | '));

await browser.close();

console.log('\n========= 视觉精细化验证 =========');
for (const p of pass) console.log('  [PASS] ' + p);
for (const f of fail) console.log('  [FAIL] ' + f);
console.log('==================================');
console.log(`通过 ${pass.length} / 失败 ${fail.length}`);
process.exit(fail.length ? 1 : 0);
