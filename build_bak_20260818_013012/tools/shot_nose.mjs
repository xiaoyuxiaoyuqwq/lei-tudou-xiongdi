/**
 * 侧视验证：摄像机定在玩家正侧方 (沿 -X 看过去)，让 +Z 指向屏幕右侧。
 * 这样能同时看到飞船的机头方向（向右）和子弹从机头射出的轨迹。
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
  Enemies.pool.each(e => { e.mesh.visible = false; return true; });
  Bullets.pPool.each(o => { o.mesh.visible = false; return true; });
  Bullets.ePool.each(o => { o.mesh.visible = false; return true; });
  Bullets.mPool.each(o => { o.mesh.visible = false; return true; });
  Loot.pool.each(o => { o.mesh.visible = false; return true; });
  Progress.weapons = { cannon: 5, missile: 0, laser: 0, aura: 0 };

  Player.x = 0; Player.z = 0; Player.vx = 0; Player.vz = 0;
  Player.yaw = 0;
  // 远处一只敌人，确保索敌锁它，yaw 锁 0，子弹沿 +Z 飞
  Enemies.spawn('charger', 0, 30, 3, 1, 1, false);

  Player.shield.material.opacity = 0;
  Player.glow.material.opacity = 0;
  Weapons.auraMesh.visible = false;
  World.shakeT = 0;

  // 关键：把游戏每帧的摄像机跟随重写成一个固定侧视
  //   摄像机在 (-16, 5, 4)，看向 (0, 1, 5) → 沿 +X 看玩家 +Z 方向 → 机头朝右、子弹向右飞
  World.updateCamera = () => {
    World.camera.position.set(-16, 5, 4);
    World.camera.lookAt(0, 1.0, 5);
  };
  World.updateCamera();

  Weapons.cd.cannon = 0;
});

// 25ms 后子弹飞了 ~1.5 单位，正好在机头右侧
await new Promise(r => setTimeout(r, 25));
await page.screenshot({
  path: path.join(__dirname, 'shot_nose.png'),
  clip: { x: 260, y: 250, width: 760, height: 280 }
});
console.log('shot_nose.png ok');
await browser.close();