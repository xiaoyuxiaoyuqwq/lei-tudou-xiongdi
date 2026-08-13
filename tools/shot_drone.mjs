// 截图：蜂巢战机（自带无人僚机）进游戏，强制 4 架无人机同屏，抓特写
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

// 选蜂巢战机（索引 8）进游戏
await page.evaluate(() => { Game.shipIdx = 8; Audio2.init(); Audio2.resume(); Game.start(false); });
await new Promise(r => setTimeout(r, 500));
// 强制 4 架无人机同屏，更直观对比大小
await page.evaluate(() => { Progress.weapons.drone = 4; });
await new Promise(r => setTimeout(r, 2800));

// 截图全屏 + 玩家中心裁剪特写
await page.screenshot({ path: path.join(__dirname, 'shot_drone.png') });
const el = await page.$('#game');
if (el) await el.screenshot({ path: path.join(__dirname, 'shot_drone_crop.png') });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
console.log('done');
