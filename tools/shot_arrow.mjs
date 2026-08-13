import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 1200));
try {
  await page.evaluate(() => {
    Game.start();
    // 关护盾、关辉光，裸机 + 让飞机朝下飞以便侧视
    Player.shield.material.opacity = 0;
    Player.glow.material.opacity = 0;
    Player.thr.userData.cone.material.opacity = 0;
    Player.thr.userData.core.material.opacity = 0;
    Player.yaw = 0.6;
    // 拉近镜头看玩家
    World.camDist = 14;
  });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(__dirname, 'shot_arrow.png') });
  console.log('shot_arrow.png 已生成');
} catch (e) { console.log('ERR: ' + e.message); }
await browser.close();