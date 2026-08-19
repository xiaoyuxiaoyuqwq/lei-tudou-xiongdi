/** 截取 UI 改造后的三种界面：开始菜单 / 暂停面板 / 结算面板 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = 1500, H = 1000;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', `--window-size=${W},${H}`]
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[err]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
await page.setViewport({ width: W, height: H });
await page.goto(PAGE, { waitUntil: 'networkidle2' });

const ready = await page.evaluate(() => typeof Game !== 'undefined' && Game.state === 'MENU');
await new Promise(r => setTimeout(r, 1200));

// 1. 开始菜单
await page.screenshot({ path: path.join(__dirname, 'shot_menu_ui.png') });
console.log('→ shot_menu_ui.png', ready ? 'OK' : 'WARN');

// 2. 暂停面板（先开局，再暂停）
await page.evaluate(() => { Audio2.init(); Audio2.resume(); Game.start(false); });
await new Promise(r => setTimeout(r, 900));
await page.evaluate(() => Game.togglePause());
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: path.join(__dirname, 'shot_pause_ui.png') });
console.log('→ shot_pause_ui.png OK');

// 3. 结算面板（恢复并触发胜利结算）
await page.evaluate(() => Game.togglePause());
await new Promise(r => setTimeout(r, 300));
await page.evaluate(() => Game.over(true));
await new Promise(r => setTimeout(r, 700));
await page.screenshot({ path: path.join(__dirname, 'shot_result_ui.png') });
console.log('→ shot_result_ui.png OK');

await browser.close();
console.log('done.');
