import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text()); });
await page.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));

await page.click('#btnStart');
await new Promise(r => setTimeout(r, 800));

console.log('--- 干净环境下单独测 BOSS ---');
let s = await page.evaluate(() => {
  Player.maxHp = 99999; Player.hp = 99999;
  Boss.spawn();
  return { state: Game.state, active: Boss.active, hp: Boss.hp, max: Boss.maxHp, phase: Boss.phase };
});
console.log('spawn:', JSON.stringify(s));

await new Promise(r => setTimeout(r, 500));
s = await page.evaluate(() => ({ state: Game.state, active: Boss.active,
   hp: Boss.hp, phase: Boss.phase, x: Boss.x.toFixed(1) }));
console.log('0.5s后:', JSON.stringify(s));

s = await page.evaluate(() => { Boss.damage(4500);
  return { hp: Boss.hp, ratio: (Boss.hp/Boss.maxHp).toFixed(3), phase: Boss.phase }; });
console.log('打4500:', JSON.stringify(s));

await new Promise(r => setTimeout(r, 700));
s = await page.evaluate(() => ({ state: Game.state, hp: Boss.hp,
   ratio: (Boss.hp/Boss.maxHp).toFixed(3), phase: Boss.phase, active: Boss.active }));
console.log('0.7s后:', JSON.stringify(s));

// 再打进 P3
s = await page.evaluate(() => { Boss.damage(4200);
  return { hp: Boss.hp, ratio: (Boss.hp/Boss.maxHp).toFixed(3) }; });
console.log('再打4200:', JSON.stringify(s));
await new Promise(r => setTimeout(r, 700));
s = await page.evaluate(() => ({ phase: Boss.phase, ratio: (Boss.hp/Boss.maxHp).toFixed(3) }));
console.log('0.7s后:', JSON.stringify(s));

console.log('\n--- 测 BOSS 能否被玩家子弹打中（空间哈希代理）---');
s = await page.evaluate(() => {
  const before = Boss.hp;
  // 把玩家瞬移到 BOSS 旁边，看武器能否命中
  Player.x = Boss.x - 6; Player.z = Boss.z;
  Progress.weapons = { cannon: 5 };
  return { before, dist: 6 };
});
await new Promise(r => setTimeout(r, 2000));
s = await page.evaluate(() => ({ hp: Boss.hp.toFixed(0), proxyAlive: Boss.proxy ? Boss.proxy.alive : null,
   target: Weapons.currentTarget ? (Weapons.currentTarget.isBoss ? 'BOSS' : Weapons.currentTarget.kind) : null }));
console.log('玩家贴脸2秒后:', JSON.stringify(s));

await browser.close();
