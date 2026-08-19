/** 渲染一张「俯视」对照图：每个候选 yaw ×2 模型，验证机头是否指向 +Z */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1600,1200']
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1200 });
await page.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 2000));

// 先把开始界面关掉
await page.evaluate(() => { HUD.hideOverlay(); Game.start(false); });
await new Promise(r => setTimeout(r, 400));
// 在世界里排一排 fighter + hauler，每个用不同 yaw，便于看机头朝向
await page.evaluate(() => {
  const scene = World.scene;
  const yaws = [-Math.PI/2, 0, Math.PI/2, Math.PI];
  const keys = ['fighter', 'hauler'];
  // 清掉已经存在的玩家与僚机
  Player.group.visible = false;
  Wingmen.list.forEach(w => w.g && (w.g.visible = false));
  for (let i = 0; i < keys.length; i++){
    for (let j = 0; j < yaws.length; j++){
      const { g } = Gfx.ship(keys[i], 0xffffff, 2);
      g.position.set((j - 1.5) * 8, 0, (i - 0.5) * -10);
      g.children.forEach(c => c.rotation.y = yaws[j]);
      // 加一根红色箭头指向模型 +Z，用以辨认"前方"
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 1.5, 6),
        new THREE.MeshBasicMaterial({ color: 0xff3344 }));
      arrow.rotation.x = Math.PI / 2;
      arrow.position.z = 2.5;
      g.add(arrow);
      scene.add(g);
    }
  }
  // 切顶视
  World.camera.position.set(0, 80, 0.01);
  World.camera.lookAt(0, 0, 0);
});
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: path.join(__dirname, 'shot_yaws.png') });
console.log('shot_yaws.png ok');
await browser.close();