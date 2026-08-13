/**
 * 截图：无人机 + 光刃 建模展示（无敌人遮挡）
 * 用法：node tools/shot_models_show.mjs
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(1500);

await page.evaluate(() => {
  Game.shipIdx = 0;            // 游隼（cannon，方便对比光环）
  Game.start(false);
  Progress.weapons = { cannon: 1, orbit: 5, drone: 5 };
  Enemies.clear();
  // 拉近相机
  CFG.camH = 6; CFG.camBack = 10;
});
await sleep(4200);    // 等「第 1 波」提示淡出
await page.screenshot({ path: path.join(__dirname, 'shot_models_show.png') });
console.log('✔ shot_models_show.png');

await browser.close();
process.exit(0);