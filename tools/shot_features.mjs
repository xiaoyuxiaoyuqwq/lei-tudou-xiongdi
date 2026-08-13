/**
 * 截图：新地图（陨石/小地图/星云）+ 新武器（散射/光刃）+ 新敌种 实战画面
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
try {
  await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));

  await page.evaluate(() => {
    Audio2.init(); Audio2.resume(); Game.start(false);
    Game.time = 6 * 60 * 6; Game.wave = 6;
    Progress.weapons.spread = 3; Progress.weapons.orbit = 4;
    Player.x = 0; Player.z = 0;
    for (let i = 0; i < 40; i++) Game.director(0.1);
  });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(__dirname, 'shot_features.png') });
  console.log('shot_features.png 已生成');
} catch (e) {
  console.log('SCRIPT ERROR:', e.message);
  console.log('PAGE ERRORS:', errs.slice(0, 5).join(' | '));
}
await browser.close();
