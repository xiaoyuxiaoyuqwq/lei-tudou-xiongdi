import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const URL = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader',
    '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--window-size=1440,900'],
});
const page = await browser.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction('typeof Game!=="undefined" && typeof Game.start==="function"', { timeout: 15000 });

// 进游戏（蜂巢战机），并把全部武器等级拉满以便同时激活 orbit/saw/chain
await page.evaluate(() => {
  Game.shipIdx = 8;
  Game.start();
  for (const k of ['cannon','missile','laser','aura','spread','orbit','chain','drone','nova','saw'])
    Progress.weapons[k] = 5;
});

// 跑一会，让敌人刷出、武器自动开火（含 orbit 旋转、saw 投掷、chain 弹射）
await new Promise(r => setTimeout(r, 2800));

const res = await page.evaluate(() => {
  const out = {};
  out.boltsLen = Weapons.bolts.length;
  out.hasTrail = !!(Weapons.blades[0] && Weapons.blades[0].trail);
  out.trailVisible = !!(Weapons.blades[0] && Weapons.blades[0].trail && Weapons.blades[0].trail.visible);
  out.hasDisc = !!(Weapons.saws[0] && Weapons.saws[0].disc);
  out.bladeVisible = Weapons.blades.some(b => b.mesh.visible);
  out.sawActive = Weapons.saws.some(s => s.active);
  out.sawDiscVisible = Weapons.saws.some(s => s.disc && s.disc.visible);
  // 手动画一条锯齿闪电并检验其几何是否偏离直线
  Weapons._chainBeam({ x: Player.x, z: Player.z }, { x: Player.x + 8, z: Player.z + 3 });
  const b = Weapons.bolts.find(x => x.line.visible);
  out.boltVisible = !!b;
  if (b) {
    const pos = b.line.geometry.attributes.position.array;
    const x0 = pos[0], z0 = pos[2], x1 = pos[10 * 3], z1 = pos[10 * 3 + 2];
    let maxDev = 0;
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const lx = x0 + (x1 - x0) * t, lz = z0 + (z1 - z0) * t;
      const dev = Math.hypot(pos[i * 3] - lx, pos[i * 3 + 2] - lz);
      if (dev > maxDev) maxDev = dev;
    }
    out.maxDev = +maxDev.toFixed(2);
  }
  out.enemies = Enemies.pool.active.length;
  return out;
});

await browser.close();
console.log(JSON.stringify({ errs, res }, null, 2));
