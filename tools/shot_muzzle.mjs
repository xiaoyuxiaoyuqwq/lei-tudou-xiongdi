/**
 * 验证子弹发射位置：玩家 + 正前方一只敌人，让玩家开火后近距离截图，
 * 直观确认子弹从机头冒出，而不是从机身侧面/尾部。
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
         '--enable-unsafe-swiftshader', '--window-size=1280,720']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

await page.evaluate(() => {
  Game.start(false);
  // 清场
  Enemies.pool.each(e => { e.mesh.visible = false; return true; });
  Bullets.pPool.each(o => { o.mesh.visible = false; return true; });
  Bullets.ePool.each(o => { o.mesh.visible = false; return true; });
  Bullets.mPool.each(o => { o.mesh.visible = false; return true; });
  Loot.pool.each(o => { o.mesh.visible = false; return true; });
  Progress.weapons = { cannon: 5, missile: 5, laser: 5, aura: 5 };
  Progress.passives = { speed: 3, rate: 3, crit: 3, pick: 3 };

  // 在玩家正前方（+Z 方向）放一只敌人 → 玩家 yaw 自动面向它 → 子弹沿 +Z 飞出
  Player.x = 0; Player.z = 0; Player.vx = 0; Player.vz = 0;
  Player.yaw = 0;
  Enemies.spawn('charger', 0, 14, 3, 1, 1, false);
  Enemies.spawn('charger', 6, 10, 3, 1, 1, false);
  Enemies.spawn('charger', -6, 10, 3, 1, 1, false);
  Enemies.spawn('charger', 0, 8, 3, 1, 1, false);

  // 关掉会遮挡的视觉
  Player.shield.material.opacity = 0;
  Player.glow.material.opacity = 0;
  Weapons.auraMesh.visible = false;
  World.shakeT = 0;

  // 强制立即重置 cd 让第一发马上打出来
  Weapons.cd.cannon = 0;
  Weapons.cd.missile = 0;
  Weapons.cd.laser = 0;
});

// 跑两秒让子弹飞出来
await new Promise(r => setTimeout(r, 1500));
// 再补一发主炮并立刻截图（在飞行轨迹短的时候最清晰）
await page.evaluate(() => {
  Weapons.cd.cannon = 0;
});
await new Promise(r => setTimeout(r, 80));

// 截玩家附近区域（摄像机跟随下玩家大致在画面中心略下）
await page.screenshot({
  path: path.join(__dirname, 'shot_muzzle.png'),
  clip: { x: 440, y: 260, width: 400, height: 280 }
});
console.log('shot_muzzle.png ok');
await browser.close();