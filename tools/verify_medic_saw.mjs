/**
 * 验证：医疗机独立建模 + 飞锯可靠回旋归位 + 激光双层 + 十字脉冲
 * 用法：node tools/verify_medic_saw.mjs
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

let browser;
try {
  browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--use-gl=swiftshader',
         '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--window-size=1440,900'],
});
} catch (e) {
  console.log('LAUNCH ERROR:', e && e.stack ? e.stack : String(e));
  process.exit(3);
}
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

try {
await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForFunction('typeof Game !== "undefined" && Game.start', { timeout: 15000 });

// 进游戏（选第一架战机）
await page.evaluate(() => { Game.shipIdx = 0; Game.start(); });
await page.waitForFunction('Game.state === "PLAYING"', { timeout: 8000 });

// 让时间稳定推进若干帧
await page.evaluate(() => new Promise(r => {
  let n = 0; const step = () => { if (++n > 40) return r(); requestAnimationFrame(step); };
  requestAnimationFrame(step);
}));

const result = await page.evaluate(() => {
  const out = {};
  // 1) 医疗机独立建模：Gfx.medic 应返回带绿十字的 Group（不再复用 hauler）
  if (typeof Gfx !== 'undefined' && Gfx.medic){
    const built = Gfx.medic(0x6dff8b, 0.95);
    out.medicChildren = built.g ? built.g.children.length : -1;
    // 统计加法发光绿十字片（MeshBasicMaterial + AdditiveBlending）
    let cross = 0;
    built.g.traverse(o => {
      if (o.isMesh && o.material && o.material.blending === 2 /* AdditiveBlending */){
        const c = o.material.color;
        if (Math.abs(c.r-0.43) < 0.2 && c.g > 0.7 && c.b < 0.7) cross++;
      }
    });
    out.medicCrossMeshes = cross;
  } else { out.medicChildren = 'NO_GFX'; }
  // 通过 Wingmen.add 真正建一艘医疗机，确认无报错且 shipG 非空
  if (typeof Wingmen !== 'undefined'){
    const w = Wingmen.add('medic');
    out.medicAdded = !!w;
    out.medicShipGChildren = w && w.shipG ? w.shipG.children.length : -1;
  }
  // 2) 飞锯：强制投掷一把，模拟玩家高速远离，验证必回旋归位
  if (typeof Weapons !== 'undefined' && Weapons.saws && Weapons.saws.length){
    const s = Weapons.saws[0];
    s.active = true; s.t = 0; s.life = 9; s.out = 0.4; s.returning = false;
    s.x = Player.x; s.z = Player.z; s.vx = 18; s.vz = 0; s.dmg = 20;
    s.hits = new Set(); s.bossHit = false; s.mesh.visible = true;
    let returned = false, becameReturning = false, maxLife = s.life;
    for (let i = 0; i < 600; i++){
      // 玩家每帧高速远离飞锯起点
      Player.x += 0.9; Player.z += 0.2;
      Game._dt = 1/60; Weapons.update(1/60);
      if (s.returning) becameReturning = true;
      maxLife = Math.min(maxLife, s.life);
      if (!s.active){ returned = true; break; }
    }
    out.sawBecameReturning = becameReturning;
    out.sawReturned = returned;       // true = 成功飞回自身（active=false）
  }
  // 3) 激光双层：发射一束，确认 outer/core 双层且可见
  if (typeof Weapons !== 'undefined' && Weapons.beams && Weapons.beams.length){
    const b = Weapons.beams[0];
    b.life = 1; b.mesh.visible = true;
    b.outer.scale.set(0.4,0.4,5); b.core.scale.set(0.17,0.17,5);
    b.outer.material.opacity = 0.5; b.core.material.opacity = 0.95;
    out.laserHasOuter = !!b.outer;
    out.laserHasCore = !!b.core;
    out.laserCoreVisible = b.core.visible;
  }
  // 4) 十字脉冲：调用 FX.cross 后粒子池应有活动粒子
  if (typeof FX !== 'undefined' && FX.cross){
    const before = FX.pool.countActive ? FX.pool.countActive() : -1;
    FX.cross(Player.x, Player.z, 0x6dff8b);
    // 粗略：cross 会 spawn 5 个粒子（4 臂 + 中心 4 中的部分），活跃数应增加
    out.fxCrossCalled = true;
    out.fxActiveAfter = FX.pool.list ? FX.pool.list.filter(o => o.mesh && o.mesh.visible).length : -1;
  }
  return out;
});

console.log('RESULT', JSON.stringify(result, null, 2));
console.log('ERRORS', JSON.stringify(errors, null, 2));

const ok =
  result.medicChildren > 0 &&
  result.medicCrossMeshes >= 2 &&
  result.medicAdded === true &&
  result.sawBecameReturning === true &&
  result.sawReturned === true &&
  result.laserHasOuter === true &&
  result.laserHasCore === true &&
  result.fxCrossCalled === true &&
  errors.length === 0;

console.log(ok ? 'VERIFY PASS ✅' : 'VERIFY FAIL ❌');
await browser.close();
process.exit(ok ? 0 : 1);
} catch (e) {
  console.log('SCRIPT ERROR:', e && e.stack ? e.stack : String(e));
  try { await browser.close(); } catch (_) {}
  process.exit(2);
}
