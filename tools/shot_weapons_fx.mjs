import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOT = path.join(__dirname, 'shot_weapons_fx.png').replace(/\\/g, '/');

const browser = await puppeteer.launch({
  headless: 'new', executablePath: CHROME,
  args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--window-size=1440,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('typeof Game!=="undefined" && typeof Game.start==="function"', { timeout: 15000 });

await page.evaluate(() => {
  Game.shipIdx = 8;            // 蜂巢（自带无人僚机）
  Game.start();
  for (const k of ['cannon','missile','laser','aura','spread','orbit','chain','drone','nova','saw'])
    Progress.weapons[k] = 5;   // 拉满，激活光刃/飞锯/闪电
});
await new Promise(r => setTimeout(r, 2000));

// 手动造一条锯齿闪电 + 确保飞锯已投出，让截图里三种特效都可见
await page.evaluate(() => {
  Weapons._chainBeam({ x: Player.x, z: Player.z }, { x: Player.x + 9, z: Player.z + 4 });
});
await new Promise(r => setTimeout(r, 150));
await page.screenshot({ path: SHOT });
await browser.close();
console.log('shot saved:', SHOT, 'errs:', errs.length);
