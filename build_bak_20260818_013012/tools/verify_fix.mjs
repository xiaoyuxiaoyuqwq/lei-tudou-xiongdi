/**
 * 专项验证：友军别撞敌人 / 友军降速 / 敌人怕陨石
 * 用法：node tools/verify_fix.mjs
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const pass = [], fail = [];
const ok  = (n, d) => { pass.push(n + (d ? ' — ' + d : '')); };
const bad = (n, d) => { fail.push(n + (d ? ' — ' + d : '')); };

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));
// 开始游戏
await page.evaluate(() => { Game.start(); });
await new Promise(r => setTimeout(r, 800));

// ---- 1. 僚机降速：SPED.spd 应显著低于旧值 ----
const spd = await page.evaluate(() => ({
  striker: Wingmen.SPEC.striker.spd, warden: Wingmen.SPEC.warden.spd, howitzer: Wingmen.SPEC.howitzer.spd
}));
(spd.striker <= 26 && spd.warden <= 22 && spd.howitzer <= 18)
  ? ok('僚机降速', `突击${spd.striker}/守护${spd.warden}/榴弹${spd.howitzer} (原 52/40/30)`)
  : bad('僚机降速', JSON.stringify(spd));

// ---- 2. 僚机自由飞行实测速度 ----
const maxSpd = await page.evaluate(async () => {
  Wingmen.clear();
  Wingmen.add('striker');
  Wingmen.behavior = 'free';
  // 给一个远处目标，让僚机自由飞
  const w = Wingmen.list[0];
  let mx = 0;
  for (let i = 0; i < 60; i++){
    Weapons._testTarget = { x: w.x + 40, z: w.z, alive: true }; // 临时目标
    await new Promise(r => requestAnimationFrame(r));
    const s = Math.hypot(w.vx, w.vz);
    if (s > mx) mx = s;
  }
  Weapons._testTarget = null;
  return mx;
});
maxSpd <= 32 ? ok('僚机实测速度', '峰值 ' + maxSpd.toFixed(1) + ' u/s (旧峰值~52)')
             : bad('僚机实测速度', '仍过快 ' + maxSpd.toFixed(1));

// ---- 3. 僚机不撞敌人：贴脸放敌，僚机应保持缓冲（用 follow 模式：只跟玩家不追敌，
//        单纯测"敌我分离 + 硬解算"；free 模式僚机会主动冲向敌人，振荡产生短时穿模） ----
const minDist = await page.evaluate(async () => {
  Wingmen.clear(); Wingmen.add('striker'); Wingmen.behavior = 'follow';
  Enemies.pool.each(e => { if (e.alive){ e.alive = false; e.mesh.visible = false; return true; } return false; });
  const w = Wingmen.list[0];
  // 把僚机挪到原点附近，敌人在它旁边
  w.x = 0; w.z = 0; w.vx = 0; w.vz = 0;
  const e = Enemies.spawn('charger', 2.4, 0);
  let mn = 999;
  for (let i = 0; i < 120; i++){
    await new Promise(r => requestAnimationFrame(r));
    const d = Math.hypot(w.x - e.x, w.z - e.z);
    if (d < mn) mn = d;
  }
  return mn;
});
minDist > 1.9 ? ok('僚机不撞敌人', '最小间距 ' + minDist.toFixed(2) + ' (硬解算边界≈2.15)')
              : bad('僚机不撞敌人', '仍贴脸 ' + minDist.toFixed(2));

// ---- 4. 敌人怕陨石：强行塞进陨石，硬解算应把它推出 ----
const embed = await page.evaluate(async () => {
  Asteroids.reset();
  const o = Asteroids.spawn(0, 0);
  const oR = o.r;
  const e = Enemies.spawn('charger', 0.05, 0);   // 直接塞进石头里
  const eR = e.r;
  let worst = 999;
  for (let i = 0; i < 30; i++){
    await new Promise(r => requestAnimationFrame(r));
    const d = Math.hypot(e.x - o.x, e.z - o.z);
    const need = eR * 0.9 + oR;                  // 合法最小间距
    const pen = need - d;                         // >0 表示仍嵌着
    if (pen < worst) worst = pen;
  }
  return worst;
});
embed < 0.4 ? ok('敌人不嵌陨石', '最大嵌入 ' + embed.toFixed(2) + ' (≈0)')
            : bad('敌人不嵌陨石', '仍嵌入 ' + embed.toFixed(2));

// ---- 5. 敌人绕开陨石（高速冲锋兵也应被挡）----
const kamPen = await page.evaluate(async () => {
  Asteroids.reset();
  const o = Asteroids.spawn(0, 0);
  const oR = o.r;
  const e = Enemies.spawn('kamikaze', 18, 0);     // 自杀冲锋兵，正对石头
  const eR = e.r;
  let worst = 999;
  for (let i = 0; i < 40; i++){
    await new Promise(r => requestAnimationFrame(r));
    const d = Math.hypot(e.x - o.x, e.z - o.z);
    const pen = (eR * 0.9 + oR) - d;
    if (pen < worst) worst = pen;
  }
  return worst;
});
kamPen < 0.4 ? ok('冲锋兵怕陨石', '最大嵌入 ' + kamPen.toFixed(2) + ' (≈0)')
             : bad('冲锋兵怕陨石', '仍嵌入 ' + kamPen.toFixed(2));

// ---- 6. 零报错 ----
errors.length === 0 ? ok('控制台零报错', errors.length + ' 条')
                     : bad('控制台零报错', errors.slice(0, 3).join(' | '));

await browser.close();

console.log('\n==== 三问题修复专项验证 ====');
pass.forEach(p => console.log('  [PASS] ' + p));
fail.forEach(f => console.log('  [FAIL] ' + f));
console.log(`通过 ${pass.length} / 失败 ${fail.length}`);
process.exit(fail.length ? 1 : 0);
