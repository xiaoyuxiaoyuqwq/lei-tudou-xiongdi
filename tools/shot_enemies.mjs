/**
 * 新敌人展示截图：玩家周围摆出 掠袭蜂(wasp) 集群 + 治愈者(mender) + 折跃者(phaser)
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

await page.evaluate(() => {
  Game.start(false);
  Game.state = 'PLAYING';
  Enemies.clear();
  Player.x = 0; Player.z = 0; Player.vx = 0; Player.vz = 0; Player.hp = 9999; Player.inv = 60;
  // 围绕玩家一圈贴脸摆位，每种独立清晰可辨
  Enemies.spawn('mender',  10, 0,  1, 1, 1, false).healCd = 99;    // 绿核心悬浮舱（右侧）
  Enemies.spawn('phaser', -10, 0,  1, 1, 1, false).blinkCd = 99;    // 紫晶折跃者（左侧）
  // 掠袭蜂集群（橙翼）排在前方弧线
  for (let i = 0; i < 5; i++){
    const a = -Math.PI/2 + (i - 2) * 0.36;
    Enemies.spawn('wasp', Math.cos(a) * 8.5, Math.sin(a) * 8.5 + 4, 1, 1, 1, false);
  }
  // 拉近相机看清新模型
  CFG.camH = 8; CFG.camBack = 12;
  // 隐藏波次横幅，避免挡脸
  const wb = document.getElementById('waveBanner'); if (wb) wb.classList.add('hide');
});
await sleep(2400);   // 等开局横幅彻底淡出 + 治愈者先放一发绿环（视觉提示）
await page.screenshot({ path: path.join(ROOT, 'tools', 'shot_enemies.png') });
console.log('✔ shot_enemies.png');

// 第二张：真实战斗（推进到第 7 波，新敌种自然登场）
await page.evaluate(() => { Game.time = 60 * 6.2; });
await sleep(2600);
await page.screenshot({ path: path.join(ROOT, 'tools', 'shot_enemies_wave.png') });
console.log('✔ shot_enemies_wave.png');

await browser.close();
