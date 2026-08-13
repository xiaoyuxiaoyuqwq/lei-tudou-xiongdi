// 截图（轻量）：主炮 + 散射 + 无人僚机，密集子弹 + 命中/受击火花 + 拖尾观感
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('#btnStart', { timeout: 10000 });
await new Promise(r => setTimeout(r, 400));

await page.evaluate(() => { Game.shipIdx = 0; Audio2.init(); Audio2.resume(); Game.start(false); });
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => {
  Progress.weapons.cannon = 5; Progress.weapons.spread = 5; Progress.weapons.drone = 4;
  Player.hp = 1e9; Player.maxHp = 1e9;
});
await new Promise(r => setTimeout(r, 3000));

await page.screenshot({ path: path.join(__dirname, 'shot_vfx.png') });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
console.log('done');
