/** 逐步诊断：打印 boot / 启动 / BOSS / 结算 各阶段真实状态 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

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
await new Promise(r => setTimeout(r, 2500));

const wait = ms => new Promise(r => setTimeout(r, ms));
const ev = fn => page.evaluate(fn);

console.log('THREE:', await ev(() => typeof THREE !== 'undefined' ? THREE.REVISION : null));
console.log('boot 文本:', await ev(() => {
  const b = document.getElementById('boot');
  return b ? (b.classList.contains('hide') ? '(已隐藏)' : b.textContent) : '(无)';
}));
console.log('模块缺失:', await ev(() => ['CFG','Util','Gfx','Pool','Grid','World','Input','Player','FX',
  'Bullets','Weapons','Enemies','Boss','Wingmen','Loot','Progress','HUD','Game']
  .filter(n => { try { return eval('typeof ' + n) === 'undefined'; } catch(e){ return true; } })));

await page.click('#btnStart');
await wait(1500);
console.log('启动后:', await ev(() => ({ state: Game.state, hp: Player.hp, lv: Progress.level })));

// 推进到 BOSS
await ev(() => { Game.time = 60 * 11.5; });
await wait(600);
console.log('推波后:', await ev(() => ({ state: Game.state, wave: Game.wave })));

await ev(() => { if (Game.state === 'LEVELUP'){ Progress.pending = 0; Game.state = 'PLAYING'; } Boss.spawn(); });
for (let i = 0; i < 40; i++){
  await ev(() => { if (Game.state === 'LEVELUP'){ Progress.pending = 0; Game.state = 'PLAYING'; } });
  if (!(await ev(() => Boss.entering))) break;
  await wait(150);
}
console.log('BOSS 生成:', await ev(() => ({ active: Boss.active, entering: Boss.entering,
  hp: Math.round(Boss.hp), maxHp: Boss.maxHp, phase: Boss.phase, state: Game.state })));

await ev(() => { Boss.damage(4500); });
await wait(1200);
console.log('打掉 4500:', await ev(() => ({ phase: Boss.phase, hp: Math.round(Boss.hp), state: Game.state })));

await ev(() => { Boss.damage(999999); });
await wait(1500);
console.log('击破后:', await ev(() => ({
  state: Game.state, bossActive: Boss.active,
  title: document.getElementById('sTitle').textContent,
  overlayHidden: document.getElementById('overlay').classList.contains('hide'),
  btnStartHidden: document.getElementById('btnStart').classList.contains('hide'),
  endlessHidden: document.getElementById('btnEndless').classList.contains('hide')
})));

console.log('\n控制台报错 ' + errors.length + ' 条:');
errors.slice(0, 12).forEach(e => console.log('  · ' + e));

await page.screenshot({ path: path.join(__dirname, 'dbg.png') });
await browser.close();
