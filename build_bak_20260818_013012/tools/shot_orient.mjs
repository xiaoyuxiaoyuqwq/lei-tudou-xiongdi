/**
 * 朝向特写：4 架敌机放在玩家四周（东南西北），放大 3 倍便于肉眼核对机头朝向玩家。
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

  const spots = [
    { kind: 'charger',  x:  8, z:  0 },
    { kind: 'orbiter',  x:  0, z:  8 },
    { kind: 'sniper',   x: -8, z:  0 },
    { kind: 'splitter', x:  0, z: -8 }
  ];
  for (const s of spots){
    const e = Enemies.spawn(s.kind, s.x, s.z, 999, 1, 1, false);
    e.spd = 0;
    e.spr.scale.setScalar(3);
  }
  Progress.pending = 0;
  if (Game.state === 'LEVELUP') Game.state = 'PLAYING';
  for (const id of ['levelup','gameover','start']){
    const el = document.getElementById(id); if (el) el.classList.add('hide');
  }
});

await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: path.join(__dirname, 'shot_orient.png') });
console.log('saved shot_orient.png');
await browser.close();