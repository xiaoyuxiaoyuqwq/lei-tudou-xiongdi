// 截图：主战机多武器全开，密集子弹 + 命中/受击火花 + 拖尾的战斗特效
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
// 多武器高等级，子弹密集；锁血避免中途 Game Over 覆盖画面
await page.evaluate(() => {
  Progress.weapons.cannon = 5; Progress.weapons.spread = 5;
  Progress.weapons.missile = 3; Progress.weapons.chain = 3;
  Progress.weapons.orbit = 3; Progress.weapons.laser = 3;
  Progress.weapons.drone = 4; Progress.weapons.nova = 3; Progress.weapons.saw = 3;
  Player.hp = 1e9; Player.maxHp = 1e9;
});
// 玩家原地，自动开火；等敌人生成 + 命中特效铺满
await new Promise(r => setTimeout(r, 4200));

await page.screenshot({ path: path.join(__dirname, 'shot_vfx.png') });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
console.log('done');
