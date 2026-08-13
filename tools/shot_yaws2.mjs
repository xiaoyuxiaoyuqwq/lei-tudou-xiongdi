/** 在游戏世界中心放一个 fighter + 一个 hauler，顶视，每个用 4 种 yaw，方便对齐 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1600,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

// 先关掉开始界面
await page.evaluate(() => { HUD.hideOverlay(); Game.start(false); });
await new Promise(r => setTimeout(r, 400));

// 在世界里排两行 fighter（上）和 hauler（下），每个用 4 种 yaw
// 红色圆点：固定指向 +Z；蓝色圆点：固定指向 -Z（玩家前进方向）
await page.evaluate(() => {
  const scene = World.scene;
  const yaws = [-Math.PI, -Math.PI/2, 0, Math.PI/2, Math.PI];
  const keys = ['fighter', 'hauler'];
  Player.group.visible = false;
  Wingmen.list.forEach(w => w.g && (w.g.visible = false));
  for (let i = 0; i < keys.length; i++){
    for (let j = 0; j < yaws.length; j++){
      const { g } = Gfx.ship(keys[i], 0xffffff, 2);
      g.position.set((j - 2) * 7, 0, (i - 0.5) * -10);
      g.children.forEach(c => c.rotation.y = yaws[j]);
      // 红 = +Z 方向，蓝 = -Z 方向（玩家飞行方向）
      const dot = (z, color) => {
        const d = new THREE.Mesh(
          new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshBasicMaterial({ color }));
        d.position.z = z;
        g.add(d);
      };
      dot( 2.5, 0xff3344);  // +Z
      dot(-2.5, 0x3388ff);  // -Z（玩家应朝向这里）
      scene.add(g);
    }
  }
  // 切顶视，相机往下看
  World.camera.position.set(0, 60, 0);
  World.camera.lookAt(0, 0, 0);
});
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: path.join(__dirname, 'shot_yaws2.png') });
console.log('shot_yaws2.png ok');
await browser.close();