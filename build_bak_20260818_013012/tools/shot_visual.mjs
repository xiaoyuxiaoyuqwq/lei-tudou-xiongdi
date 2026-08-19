/**
 * 截图：建模 + 地图精细化效果（描边/导航灯/引擎辉光/星云/陨石/边界脉冲）
 * 用法：node tools/shot_visual.mjs  →  tools/shot_visual.png
 */
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
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));

try {
  await page.evaluate(() => {
    Audio2.init(); Audio2.resume(); Game.start(false);
    Player.setShip(1);                       // 游骑兵（绿），描边/导航灯更明显
    Player.x = 0; Player.z = 0;
    Asteroids.reset(); Asteroids.scatter(16);
    Wingmen.clear(); Wingmen.add('striker'); Wingmen.add('warden'); Wingmen.add('howitzer');
    // 四面放几种敌人，展示尾部引擎辉光 + 机型差异
    Enemies.spawn('charger', 12, 6, 1, 1, 1, false);
    Enemies.spawn('orbiter', -14, 4, 1, 1, 1, false);
    Enemies.spawn('sniper', 6, -14, 1, 1, 1, false);
    Enemies.spawn('splitter', -8, -12, 1, 1, 1, false);
    Enemies.spawn('brute', 2, 16, 1, 1, 1, false);
    Enemies.spawn('turret', -18, -8, 1, 1, 1, false);
    Enemies.spawn('kamikaze', 16, -4, 1, 1, 1, true);   // 精英，金色高亮
    Weapons.update(0.1);
  });
  // 让描边/辉光/脉冲动起来几帧
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(__dirname, 'shot_visual.png') });
  console.log('shot_visual.png 已生成');
} catch (e) {
  console.log('SCRIPT ERROR:', e.message);
  console.log('PAGE ERRORS:', errs.slice(0, 3).join(' | '));
}
await browser.close();
