/**
 * 击杀爆炸特写：用大号普通敌机避免稀有掉落触发升级；击杀后立即清掉所有掉落。
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle',
         '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
await page.click('#btnStart');
await new Promise(r => setTimeout(r, 600));

await page.evaluate(() => {
  Enemies.spawnTimer = 9999;
  Player.maxHp = 9999; Player.hp = 9999;
  Player.x = 0; Player.z = 0;
  Game.wave = 10;

  // 几个观感好的敌机（全是普通型，不触发稀有掉率）
  const list = [
    { kind: 'charger',  x: 0,  z: 0,  scale: 4 },
    { kind: 'charger',  x: 9,  z: -3 },
    { kind: 'splitter', x: -10, z: 5 },
    { kind: 'sniper',   x: 8,  z: 9 },
    { kind: 'orbiter',  x: -7, z: -9 }
  ];
  for (const s of list){
    const e = Enemies.spawn(s.kind, s.x, s.z, 9999, 1, 1, false);
    e.spd = 0;
    if (s.scale) e.spr.scale.multiplyScalar(s.scale);
  }

  // 击杀中央充能者，立即清空掉落防止弹窗
  const c = Enemies.pool.active.find(e => e.kind === 'charger' && e.x === 0);
  if (c) Enemies.kill(c);
  Loot.pool.releaseAll();
  Loot.itemPool.releaseAll();

  Progress.pending = 0;
  if (Game.state === 'LEVELUP') Game.state = 'PLAYING';
  for (const id of ['levelup','gameover','start']){
    const el = document.getElementById(id); if (el) el.classList.add('hide');
  }
});

await new Promise(r => setTimeout(r, 150));
await page.screenshot({ path: path.join(__dirname, 'shot_boom.png') });
console.log('saved shot_boom.png');
await browser.close();