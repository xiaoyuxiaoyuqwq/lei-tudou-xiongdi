/** 单独渲染玩家飞船 + 僚机 + BOSS，方便核对朝向 */
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
  Progress.applyCard({ type:'wing', key:'striker' });
  Progress.applyCard({ type:'wing', key:'warden' });
  Player.yaw = 0;
  Player.group.rotation.y = 0;
  Player.shield.material.opacity = 0;   // 截图时关掉护盾球，露出飞船
  Player.glow.material.opacity = 0;     // 关掉地面光晕
  World.shakeT = 0;
});
await new Promise(r => setTimeout(r, 500));

await page.screenshot({ path: path.join(__dirname, 'shot_player.png'), clip: {x:400,y:200,width:480,height:320} });
console.log('shot_player.png ok');
await browser.close();