/**
 * 截图：菜单（9 架战机含天赋/初始武器 tag）+ 战斗（nova 新星 + saw 飞锯特效）
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE  = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new',
  args: ['--no-sandbox','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(2500);

// 1) 菜单：9 架战机选择页
await page.screenshot({ path: path.join(ROOT, 'tools', 'shot_weapons_menu.png') });
console.log('✔ shot_weapons_menu.png');

// 2) 战斗：nova + saw 特效
await page.evaluate(() => {
  Game.start(false);
  Game.state = 'PLAYING';
  Enemies.clear();
  Player.x = 0; Player.z = 0; Player.yaw = 0;
  Progress.weapons = { cannon: 1, nova: 5, saw: 5 };
  // 周围撒一圈敌人，方便新星/飞锯展示
  const ring = [ [6,0],[-6,0],[0,6],[0,-6],[8,4],[-8,-4],[4,8],[-4,-8] ];
  ring.forEach((p, i) => Enemies.spawn(i % 2 ? 'charger' : 'orbiter', p[0], p[1], 1, 1, 1, false));
  CFG.camH = 13; CFG.camBack = 20;
});
// 等新星爆发 + 飞锯掷出
await sleep(2200);
await page.screenshot({ path: path.join(ROOT, 'tools', 'shot_weapons_combat.png') });
console.log('✔ shot_weapons_combat.png');

await browser.close();
