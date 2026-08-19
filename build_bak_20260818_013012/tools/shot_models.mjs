/**
 * 截图：无人僚机 + 环绕光刃 真 3D 建模效果
 * 用法：node tools/shot_models.mjs
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

// 战斗：满级无人僚机 + 光刃，周围一圈敌人
async function setup(){
  await page.evaluate(() => {
    Game.shipIdx = 5;                       // 幽影（光刃 + 移速）
    Game.start(false);
    Progress.weapons = { cannon: 1, orbit: 5, drone: 5, chain: 1 };
    Weapons.cd.chain = -1;
    Enemies.clear();
    for (let i = 0; i < 16; i++)
      Enemies.spawn(['charger','brute','orbiter'][i % 3], -8 + i * 1.1, 9 + (i % 5) - 2);
  });
  await sleep(2200);
  await page.evaluate(() => { Weapons.cd.chain = -1; });
  await sleep(140);
}

// 1) 标准视角：战场全貌（无人机环绕 + 光刃环 + 敌人）
await setup();
await page.screenshot({ path: path.join(__dirname, 'shot_models_combat.png') });
console.log('✔ shot_models_combat.png');

// 2) 拉近视角：更清楚看到无人机/光刃建模
await page.evaluate(() => { CFG.camH = 9; CFG.camBack = 12; });
await sleep(400);
await page.screenshot({ path: path.join(__dirname, 'shot_models_close.png') });
console.log('✔ shot_models_close.png');

await browser.close();
process.exit(0);
