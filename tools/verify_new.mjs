/**
 * 新功能验证：新武器/新敌人/陨石/小地图/僚机自由移动/突变卡
 * 用法：node tools/verify_new.mjs
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

// 开局
await page.evaluate(() => { Audio2.init(); Audio2.resume(); Game.start(false); });
await new Promise(r => setTimeout(r, 600));

// 1) 陨石已散布
const ast = await page.evaluate(() => Asteroids.pool.active.filter(o => o.alive).length);
ast >= 10 ? ok('陨石散布', ast + ' 块') : bad('陨石散布', ast + ' 块');

// 2) 小地图画布存在且有尺寸
const mm = await page.evaluate(() => { const c = document.getElementById('minimap'); return c ? c.width : 0; });
mm === 150 ? ok('小地图画布', '150×150') : bad('小地图画布', 'w=' + mm);

// 3) 推到高波次，催生 kamikaze / turret
const kinds = await page.evaluate(async () => {
  Game.time = 6 * 60 * 5;        // 跳到第 5 波之后
  Game.wave = 5;
  for (let i = 0; i < 60; i++){
    Game.director(0.1);
    await new Promise(r => setTimeout(r, 0));
  }
  const set = new Set(Enemies.pool.active.filter(e => e.alive).map(e => e.kind));
  return [...set];
});
(kinds.includes('kamikaze') && kinds.includes('turret'))
  ? ok('新敌种出现', kinds.join(',')) : bad('新敌种出现', kinds.join(',') || '无');

// 4) 新武器：散射 + 环绕光刃
const wres = await page.evaluate(async () => {
  Progress.weapons.spread = 1; Progress.weapons.orbit = 3;
  const before = Bullets.pPool.count;
  // 放一个敌人当靶
  Enemies.spawn('charger', Player.x + 6, Player.z, 1, 1, 1, false);
  for (let i = 0; i < 30; i++){ Weapons.update(0.05); await new Promise(r => setTimeout(r, 0)); }
  const bladesVisible = Weapons.blades.filter(b => b.mesh.visible).length;
  return { bullets: Bullets.pPool.count, blades: bladesVisible };
});
(wres.bullets > 0 && wres.blades >= 3)
  ? ok('新武器生效', '散射弹 ' + wres.bullets + ' · 光刃 ' + wres.blades + ' 柄')
  : bad('新武器生效', JSON.stringify(wres));

// 5) 僚机自由移动：远离母机后不应黏在身后
const wing = await page.evaluate(async () => {
  Wingmen.clear();
  Wingmen.add('striker'); Wingmen.add('warden');
  Wingmen.behavior = 'free';
  // 把玩家挪到一边，让僚机自由游走几秒
  Player.x = 20; Player.z = 20;
  for (let i = 0; i < 120; i++){ Wingmen.update(0.05); await new Promise(r => setTimeout(r, 0)); }
  const w = Wingmen.list[0];
  return { dist: Math.hypot(w.x - Player.x, w.z - Player.z), behavior: Wingmen.behavior };
});
(wing.dist > 4 && wing.behavior === 'free')
  ? ok('僚机自由移动', '距母机 ' + wing.dist.toFixed(1) + '（自主游走）')
  : bad('僚机自由移动', JSON.stringify(wing));

// 6) 僚机行为切换
const beh = await page.evaluate(() => { Wingmen.cycleFormation(); return Wingmen.behavior; });
['free','follow','guard'].includes(beh) ? ok('僚机行为切换', beh) : bad('僚机行为切换', beh);

// 7) 突变卡（强制高等级后多次 roll，至少有一次出现 mutation）
const mut = await page.evaluate(() => {
  Progress.level = 8;
  let got = false;
  for (let i = 0; i < 200 && !got; i++){
    Progress.roll();
    if (Progress.cards.some(c => c.type === 'mutation')) got = true;
  }
  return got;
});
mut ? ok('突变卡', 'LV8 后出现') : bad('突变卡', '200 次 roll 未出现');

// 8) 零控制台报错
errors.length === 0 ? ok('控制台零报错') : bad('控制台报错', errors.slice(0, 3).join(' | '));

await browser.close();

console.log('\n========= 新功能验证 =========');
for (const p of pass) console.log('  [PASS] ' + p);
for (const f of fail) console.log('  [FAIL] ' + f);
console.log('================================');
console.log(`通过 ${pass.length} / 失败 ${fail.length}`);
process.exit(fail.length ? 1 : 0);
