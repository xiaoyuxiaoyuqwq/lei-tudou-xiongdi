/**
 * 截图：菜单（6 机型含天赋/初始武器卡片） + 战斗（环绕光刃/无人机/僚机/连锁闪电）
 * 用法：node tools/shot_round.mjs
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

// 1) 菜单：6 机型卡片
await page.screenshot({ path: path.join(__dirname, 'shot_menu_round.png') });
console.log('✔ shot_menu_round.png');

// 2) 战斗：幽影(光刃) + 医疗/幽灵僚机 + 连锁/无人机
await page.evaluate(() => {
  Game.shipIdx = 5;            // 幽影（环绕光刃 + 移速天赋）
  Game.start(false);
  Progress.weapons = { cannon: 1, orbit: 1, chain: 2, drone: 2 };
  Weapons.cd.chain = -1;
  Wingmen.clear();
  Wingmen.add('medic'); Wingmen.add('phantom'); Wingmen.add('striker');
  for (let i = 0; i < 14; i++) Enemies.spawn(['charger','brute','orbiter'][i % 3], -6 + i * 1.4, 10 + (i % 4));
});
// 让无人机/光刃/僚机就位，并触发一次连锁闪电
await sleep(2500);
await page.evaluate(() => { Weapons.cd.chain = -1; });
await sleep(120);
await page.screenshot({ path: path.join(__dirname, 'shot_combat_round.png') });
console.log('✔ shot_combat_round.png');

await browser.close();
process.exit(0);
