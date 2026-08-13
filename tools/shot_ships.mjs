/**
 * 截图验证「更多战机」：
 *   1) 开局界面（含机型选择卡片）
 *   2) 依次选 4 种战机，各截一张侧视特写，确认造型/配色正确
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
await new Promise(r => setTimeout(r, 1500));

// 1) 开局界面（含机型卡片）
await page.screenshot({ path: path.join(__dirname, 'shot_menu.png') });
console.log('shot_menu.png ok');

// 2) 4 种战机侧视特写
for (let idx = 0; idx < 4; idx++){
  await page.evaluate((i) => {
    Game.shipIdx = i;
    Game.start(false);
    Enemies.pool.each(e => { e.mesh.visible = false; return true; });
    Bullets.pPool.each(o => { o.mesh.visible = false; return true; });
    Bullets.ePool.each(o => { o.mesh.visible = false; return true; });
    Bullets.mPool.each(o => { o.mesh.visible = false; return true; });
    Loot.pool.each(o => { o.mesh.visible = false; return true; });
    Player.x = 0; Player.z = 0; Player.vx = 0; Player.vz = 0; Player.yaw = 0;
    Player.shield.material.opacity = 0;
    Player.glow.material.opacity = 0;
    Weapons.auraMesh.visible = false;
    World.shakeT = 0;
    World.updateCamera = () => {
      World.camera.position.set(-16, 5, 4);
      World.camera.lookAt(0, 1.0, 5);
    };
    World.updateCamera();
  }, idx);
  await new Promise(r => setTimeout(r, 30));
  await page.screenshot({
    path: path.join(__dirname, `shot_ship_${idx}.png`),
    clip: { x: 260, y: 250, width: 760, height: 280 }
  });
  console.log(`shot_ship_${idx}.png ok (${['游隼','游骑兵','先锋','泰坦'][idx]})`);
}
await browser.close();
