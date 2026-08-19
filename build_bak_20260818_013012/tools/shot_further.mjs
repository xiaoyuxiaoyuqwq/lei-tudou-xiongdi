/**
 * 进一步优化 实机截图
 * 用法：node tools/shot_further.mjs  → tools/shot_further.png
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.join(__dirname, 'shot_further.png');

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

try {
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2200));
  await page.click('#btnStart');
  await new Promise(r => setTimeout(r, 1200));
  // 跳到后期波次，大量敌人 + 陨石，弹道拖尾明显
  await page.evaluate(() => {
    Game.time = 300; Game.wave = 6;
    Progress.weapons.spread = 3; Progress.weapons.orbit = 4;
    Player.hp = 1e9; Player.inv = 1e9;
    Weapons.update(0.016);
  });
  await new Promise(r => setTimeout(r, 1600));
  // 召唤 BOSS 看威严造型（外环 + 卫星舱），跳过进场演出
  await page.evaluate(() => { Boss.spawn(); Boss.entering = false; });
  await new Promise(r => setTimeout(r, 1800));
  await page.screenshot({ path: OUT });
  console.log('shot_further.png 已生成 · 控制台错误', errs.length);
} catch (e) {
  console.log('SCRIPT ERROR:', e.message);
  console.log('PAGE ERRORS:', errs.join(' | '));
  process.exitCode = 1;
} finally {
  await browser.close();
}
