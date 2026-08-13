/**
 * 3D 主角朝向特写：玩家放大摆在中心，按 4 个机头方向截图
 * 验证 Gfx.build 模型的 +Z 机头约定 & 与 yaw 旋转的对应关系
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle',
         '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--window-size=1280,800']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
await page.click('#btnStart');
await new Promise(r => setTimeout(r, 600));

const shots = [
  { yaw: 0,            name: 'fwd'   },   // 朝 +Z（屏幕上方）
  { yaw: Math.PI/2,    name: 'right' },   // 朝 +X（屏幕右）
  { yaw: Math.PI,      name: 'back'  },   // 朝 -Z（屏幕下方）
  { yaw: -Math.PI/2,   name: 'left'  }    // 朝 -X（屏幕左）
];

for (const s of shots){
  await page.evaluate((y) => {
    Enemies.spawnTimer = 99999;
    Player.maxHp = 99999; Player.hp = 99999;
    Player.x = 0; Player.z = 0;
    Player.yaw = y; Player.facing = y;
    Weapons.currentTarget = null;
    // 放大 + 压暗光晕/尾焰/阴影，让模型细节清晰可见
    Player.shipG.scale.setScalar(4.5);
    Player.glow.material.opacity = 0.18;
    Player.thruster.material.opacity = 0.15;
    Player.shadow.visible = false;
    Progress.pending = 0;
    Game.enterLevelUp = () => {};
    if (Game.state === 'LEVELUP') Game.state = 'PLAYING';
    for (const id of ['levelup','gameover','start','wavetip','bossbar']){
      const el = document.getElementById(id); if (el) el.classList.add('hide');
    }
  }, s.yaw);
  await new Promise(r => setTimeout(r, 1100));   // 等平滑插值稳定
  await page.screenshot({ path: path.join(__dirname, `shot_orient3d_${s.name}.png`) });
}

console.log('errors:', errs.length, errs.slice(0,2).join(' | '));
await browser.close();