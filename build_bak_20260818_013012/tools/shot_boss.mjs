/** 单独渲染 BOSS 真 3D 模型 */
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
page.on('console', m => console.log('[page]', m.text()));
await page.setViewport({ width: 1280, height: 720 });
await page.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

await page.evaluate(() => {
  Game.start(false);
  Boss.spawn();
  Boss.entering = false;
  // 一次性做完所有事
  Boss.g.scale.setScalar(1.0);
  Boss.g.position.set(0, 0, -8);
  Boss.g.rotation.set(0, 0, 0);
  Player.shield.material.opacity = 0;
  Player.glow.material.opacity = 0;
  Player.group.visible = false;
  Enemies.pool.each(e => { e.mesh.visible = false; return true; });
  Bullets.pPool.each(o => { o.mesh.visible = false; return true; });
  Loot.pool.each(o => { o.mesh.visible = false; return true; });
  World.shakeT = 0;
  cancelAnimationFrame(Game._raf);
  Game._raf = 0;
  World.camera.position.set(0, 8, 12);
  World.camera.lookAt(0, 0, -10);
  // 调试：把 BOSS 的世界位置和包围盒打印出来
  Boss.g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(Boss.g);
  const wp = new THREE.Vector3(); Boss.g.getWorldPosition(wp);
  console.log('BOSS scale=' + Boss.g.scale.x + ' pos=' + JSON.stringify(Boss.g.position.toArray()) +
              ' visible=' + Boss.g.visible + ' children=' + Boss.g.children.length +
              ' world=' + JSON.stringify(wp.toArray()) +
              ' bb=' + JSON.stringify([bb.min.toArray(), bb.max.toArray()]) +
              ' cam=' + JSON.stringify(World.camera.position.toArray()));
});
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: path.join(__dirname, 'shot_boss.png'),
  clip: { x: 280, y: 60, width: 720, height: 540 } });
console.log('shot_boss.png ok');
await browser.close();