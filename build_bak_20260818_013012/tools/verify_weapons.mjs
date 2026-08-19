/**
 * 新武器 + 新战机专项验证：nova / saw / 3 架新机(猎手·重锤·蜂巢)
 *   1) nova 与 saw 进入 W_INFO 卡池（图标/名称存在）
 *   2) nova 爆发：对范围内敌人造成 AoE 伤害（敌 hp 下降）
 *   3) saw 飞锯：掷出后沿瞄准方向飞出、穿透、回旋归位（saws 有 active 实例且命中敌人）
 *   4) 激光 beam() 多目标命中修复：_pi 唯一 → 一条激光能打到多只敌人
 *   5) 3 架新机 天赋+初始武器 正确接入 Progress.reset
 *   6) 全程零控制台报错
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE  = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new',
  args: ['--no-sandbox','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto('file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(2500);

// 1) W_INFO 含 nova / saw
const info = await page.evaluate(() => ({
  nova: !!(Progress.W_INFO.nova), saw: !!(Progress.W_INFO.saw),
  novaIcon: Progress.W_INFO.nova && Progress.W_INFO.nova.icon,
  sawIcon:  Progress.W_INFO.saw  && Progress.W_INFO.saw.icon,
}));
ok(info.nova && info.saw, 'nova/saw 进入卡池 W_INFO（icon=' + info.novaIcon + '/' + info.sawIcon + '）');

// 2) nova 范围 AoE：放三只敌人，触发一次 nova，hp 应下降
const novaRes = await page.evaluate(async () => {
  Game.start(false); Game.state = 'PLAYING'; Enemies.clear();
  const e1 = Enemies.spawn('charger', 3, 0, 1, 1, 1, false);
  const e2 = Enemies.spawn('charger', -3, 0, 1, 1, 1, false);
  const e3 = Enemies.spawn('charger', 0, 4, 1, 1, 1, false);
  const before = [e1.hp, e2.hp, e3.hp];
  // 直接拥有 nova L5（范围 11，足够覆盖），并把 cd 清零触发
  Progress.weapons.nova = 5; Weapons.cd.nova = 0;
  for (let i = 0; i < 6; i++){ await new Promise(r => requestAnimationFrame(r)); }
  return { before, after: [e1.hp, e2.hp, e3.hp], any: e1.hp < before[0] || e2.hp < before[1] || e3.hp < before[2] };
});
ok(novaRes.any, 'nova 爆发对范围内敌人造成 AoE 伤害（hp ' + novaRes.before.join('/') + ' → ' + novaRes.after.join('/') + '）');

// 3) saw 飞锯：掷出、飞行、命中
const sawRes = await page.evaluate(async () => {
  Game.start(false); Game.state = 'PLAYING'; Enemies.clear();
  const e = Enemies.spawn('brute', 6, 0, 1, 1, 1, false);
  const hp0 = e.hp;
  Progress.weapons.saw = 3; Weapons.cd.saw = 0;
  // 玩家朝 +X（敌人方向）瞄准
  Player.x = 0; Player.z = 0; Player.yaw = 0;
  let sawed = false, hitDrop = false;
  for (let i = 0; i < 90; i++){
    await new Promise(r => requestAnimationFrame(r));
    if (Weapons.saws.some(s => s.active)) sawed = true;
    if (e.hp < hp0) hitDrop = true;
  }
  return { sawed, hitDrop, hp0, hp: e.hp };
});
ok(sawRes.sawed, 'saw 飞锯成功掷出并飞行（saws 存在 active 实例）');
ok(sawRes.hitDrop, 'saw 飞锯穿透命中敌人（敌 hp ' + sawRes.hp0 + ' → ' + Math.round(sawRes.hp) + '）');

// 4) 激光多目标修复：_pi 唯一，一条 beam 应打到 3 只共线敌人
const beamRes = await page.evaluate(async () => {
  Game.start(false); Game.state = 'PLAYING'; Enemies.clear();
  const a = Enemies.spawn('charger', 5,  0, 1, 1, 1, false);
  const b = Enemies.spawn('charger', 9,  0, 1, 1, 1, false);
  const c = Enemies.spawn('charger', 13, 0, 1, 1, 1, false);
  const ha = a.hp, hb = b.hp, hc = c.hp;
  // 玩家在原点朝 +X，开一束 laser（n=1 也沿射线采样）
  Player.x = 0; Player.z = 0; Player.yaw = 0;
  Progress.weapons.laser = 5;
  // 先推进几帧让敌人进入空间网格（真实游戏循环每帧插入）
  for (let i = 0; i < 4; i++){ await new Promise(r => requestAnimationFrame(r)); }
  Weapons.beam({ x: 20, z: 0 }, Weapons.TABLE.laser[4], 5);
  return { a: ha - a.hp, b: hb - b.hp, c: hc - c.hp, pids: [a._pi, b._pi, c._pi] };
});
ok(beamRes.a > 0 && beamRes.b > 0 && beamRes.c > 0,
   '激光 beam 多目标命中（三敌均受伤 ' + Math.round(beamRes.a) + '/' + Math.round(beamRes.b) + '/' + Math.round(beamRes.c) + '）');
ok(new Set(beamRes.pids).size === 3, '敌人 _pi 唯一（' + beamRes.pids.join(',') + '）');

// 5) 3 架新机 天赋 + 初始武器
const ships = await page.evaluate(() => {
  const out = {};
  const want = {
    hunter:  { w: ['cannon','laser'],  p: ['crit'] },
    bulwark: { w: ['cannon','aura'],   p: ['armor'] },
    hive:    { w: ['cannon','drone'],  p: ['speed'] },
  };
  for (const s of SHIPS){
    if (!want[s.id]) continue;
    // 通过 Game.start 走真实路径
    Game.shipIdx = SHIPS.indexOf(s);
    Game.start(false);
    const w = Object.keys(Progress.weapons);
    const p = Object.keys(Progress.passives);
    out[s.id] = { w, p, start: s.startWeapon, tal: s.talent };
  }
  return out;
});
const wantMap = {
  hunter:  { w: ['cannon','laser'],  p: ['crit'] },
  bulwark: { w: ['cannon','aura'],   p: ['armor'] },
  hive:    { w: ['cannon','drone'],  p: ['speed'] },
};
const shipOk = id => {
  const r = ships[id], w = wantMap[id];
  const wOk = w.w.every(k => r.w.includes(k));
  const pOk = r.p.length === 1 && r.p[0] === w.p[0];
  ok(wOk && pOk, id + ' 初始武器[' + r.w.join(',') + '] 天赋[' + r.p.join(',') + ']');
};
shipOk('hunter'); shipOk('bulwark'); shipOk('hive');

// 6) 零报错
ok(errors.length === 0, '全程零控制台报错（' + errors.length + '）' + (errors.length ? ' → ' + errors.slice(0,3).join(' | ') : ''));

await browser.close();
console.log('\n=== verify_weapons: ' + pass + ' 通过 / ' + fail + ' 失败 ===');
process.exit(fail ? 1 : 0);
