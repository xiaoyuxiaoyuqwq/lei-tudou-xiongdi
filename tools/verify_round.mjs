/**
 * 专项验证：Request B（参考土豆兄弟的多飞机 / 天赋 / 初始武器 / 新武器 / 新僚机 / 移除箭头）
 * 用法：node tools/verify_round.mjs
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
await sleep(1500);

// ---- 0. SHIPS 数据完整性（6 机 + 天赋 + 初始武器 + 描述）----
const ships = await page.evaluate(() => SHIPS.map(s => ({
  id:s.id, name:s.name, talent:s.talent, startWeapon:s.startWeapon, trait:s.trait
})));
(ships.length === 9 && ships.every(s => s.name && s.startWeapon && s.trait))
  ? ok('机型表', `共 ${ships.length} 种，均含 天赋/初始武器/描述`)
  : bad('机型表', JSON.stringify(ships));

// ---- 1. 新武器在 TABLE + W_INFO ----
const wdef = await page.evaluate(() => ({
  chain: !!(Weapons.TABLE.chain && Weapons.TABLE.chain.length === 5),
  drone: !!(Weapons.TABLE.drone && Weapons.TABLE.drone.length === 5),
  info: !!(Progress.W_INFO.chain && Progress.W_INFO.drone)
}));
(wdef.chain && wdef.drone && wdef.info)
  ? ok('新武器定义', '连锁闪电 ×5 级 / 无人僚机 ×5 级 / W_INFO 已登记')
  : bad('新武器定义', JSON.stringify(wdef));

// ---- 2. 闪电链生效（beams 出现 + 敌人受击）----
const chainRes = await page.evaluate(async () => {
  Game.start(false);
  Progress.weapons = { chain: 1 };
  Weapons.cd.chain = -1;
  Enemies.clear();
  const es = [Enemies.spawn('charger', 5, 0), Enemies.spawn('charger', 9, 0), Enemies.spawn('charger', 13, 0)];
  const hp0 = es.reduce((a, e) => a + e.hp, 0);
  let beamPeak = 0;
  for (let i = 0; i < 30; i++){
    await new Promise(r => requestAnimationFrame(r));
    const vis = Weapons.beams.filter(b => b.mesh.visible).length;
    if (vis > beamPeak) beamPeak = vis;
  }
  const hp1 = es.reduce((a, e) => a + (e.alive ? e.hp : 0), 0);
  return { beamPeak, dmg: hp0 - hp1 };
});
(chainRes.beamPeak > 0 && chainRes.dmg > 0)
  ? ok('连锁闪电', `电弧光束峰值 ${chainRes.beamPeak} 束，敌人共受击 ${chainRes.dmg.toFixed(0)}`)
  : bad('连锁闪电', JSON.stringify(chainRes));

// ---- 3. 无人僚机生效（环绕 + 开火造成伤害）----
const droneRes = await page.evaluate(async () => {
  Game.start(false);
  Progress.weapons = { drone: 1 };
  Weapons.cd.drone = -1;
  Enemies.clear();
  const e = Enemies.spawn('brute', 7, 0);
  const hp0 = e.hp;
  const p0 = Weapons.drones.map(d => ({ x: d.mesh.position.x, z: d.mesh.position.z }));
  let anyVisible = false;
  for (let i = 0; i < 50; i++){
    await new Promise(r => requestAnimationFrame(r));
    if (Weapons.drones.some(d => d.mesh.visible)) anyVisible = true;
  }
  const hp1 = e.alive ? e.hp : 0;
  const moved = Weapons.drones.some((d, i) => Math.hypot(d.mesh.position.x - p0[i].x, d.mesh.position.z - p0[i].z) > 0.2);
  return { n: Weapons.drones.length, anyVisible, moved, dmg: hp0 - hp1 };
});
(droneRes.n === 5 && droneRes.anyVisible && droneRes.moved && droneRes.dmg > 0)
  ? ok('无人僚机', `5 架环绕飞行并开火，造成 ${droneRes.dmg.toFixed(0)} 伤害`)
  : bad('无人僚机', JSON.stringify(droneRes));

// ---- 4. 新僚机在 SPEC ----
const wing = await page.evaluate(() => ({
  phantom: !!(Wingmen.SPEC.phantom && Wingmen.SPEC.phantom.dmg > 0),
  medic:   !!(Wingmen.SPEC.medic && Wingmen.SPEC.medic.dmg === 0)
}));
(wing.phantom && wing.medic)
  ? ok('新僚机定义', '幽灵刺客(高伤穿透) + 医疗机(回血) 已登记')
  : bad('新僚机定义', JSON.stringify(wing));

// ---- 5. 幽灵刺客开火（穿透弹色 0xb980ff）----
const phantomRes = await page.evaluate(async () => {
  Game.start(false);
  Wingmen.clear(); Wingmen.add('phantom');
  Enemies.clear();
  Enemies.spawn('charger', 8, 0);
  let saw = false;
  for (let i = 0; i < 60; i++){
    await new Promise(r => requestAnimationFrame(r));
    Bullets.pPool.each(b => { if (b.mesh.visible && b.mesh.material.color.getHex() === 0xb980ff) saw = true; });
    if (saw) break;
  }
  return saw;
});
phantomRes ? ok('幽灵刺客开火', '检测到紫色穿透弹 (0xb980ff)')
           : bad('幽灵刺客开火', '未发射');

// ---- 6. 医疗机回血 ----
const medicRes = await page.evaluate(async () => {
  Game.start(false);
  Wingmen.clear(); Wingmen.add('medic');
  Enemies.clear();
  Player.hp = 5;
  const h0 = Player.hp;
  await new Promise(r => setTimeout(r, 3900));   // 医疗机 cd 3.2s + 余量
  return { h0, h1: Player.hp };
});
(medicRes.h1 > medicRes.h0)
  ? ok('医疗机回血', `HP ${medicRes.h0} → ${medicRes.h1.toFixed(0)}`)
  : bad('医疗机回血', JSON.stringify(medicRes));

// ---- 7. 每架飞机的 天赋 + 初始武器（VS 风格）----
const shipCheck = await page.evaluate(() => {
  const expect = {
    falcon:   { w: ['cannon'],          p: [] },
    ranger:   { w: ['cannon'],          p: ['rate'] },
    vanguard: { w: ['cannon'],          p: ['armor'] },
    titan:    { w: ['cannon'],          p: ['hp'] },
    storm:    { w: ['cannon','spread'], p: ['crit'] },
    specter:  { w: ['cannon','orbit'],  p: ['speed'] },
    hunter:   { w: ['cannon','laser'],  p: ['crit'] },
    bulwark:  { w: ['cannon','aura'],   p: ['armor'] },
    hive:     { w: ['cannon','drone'],  p: ['speed'] },
  };
  const out = {};
  for (let i = 0; i < SHIPS.length; i++){
    Game.shipIdx = i; Game.start(false);
    const id = SHIPS[i].id;
    const e = expect[id];
    const w = Object.keys(Progress.weapons).filter(k => Progress.weapons[k]);
    const p = Object.keys(Progress.passives).filter(k => Progress.passives[k]);
    const wOK = e.w.every(k => w.includes(k)) && w.length === e.w.length;
    const pOK = e.p.every(k => p.includes(k)) && p.length === e.p.length;
    out[id] = { w, p, ok: wOK && pOK };
  }
  return out;
});
const shipBad = Object.entries(shipCheck).filter(([k, v]) => !v.ok).map(([k, v]) => `${k}:${v.w.join('+')}/${v.p.join('+')}`);
shipBad.length === 0
  ? ok('天赋+初始武器', '游隼/游骑兵/先锋/泰坦/风暴/幽影 各自正确')
  : bad('天赋+初始武器', shipBad.join(' '));

// ---- 8. 移除"头上箭头"：座舱罩存在 + 推进器火焰缩小 ----
const modelRes = await page.evaluate(() => {
  Game.shipIdx = 0; Game.start(false);
  const ADD = THREE.AdditiveBlending;
  const canopy = Player.shipG.children.some(c =>
    c.geometry && c.geometry.type === 'SphereGeometry' && c.position.y > 0.4 && c.material.blending === ADD);
  const coneR = Player.thr.userData.cone.geometry.parameters.radius;
  return { canopy, coneR };
});
(modelRes.canopy && modelRes.coneR < 0.15)
  ? ok('建模优化/去箭头', `机头座舱罩就位，推进器锥半径 ${modelRes.coneR.toFixed(2)} (旧 0.21)`)
  : bad('建模优化/去箭头', JSON.stringify(modelRes));

// ---- 9. 零报错 ----
errors.length === 0 ? ok('控制台零报错', errors.length + ' 条')
                     : bad('控制台零报错', errors.slice(0, 3).join(' | '));

await browser.close();

console.log('\n==== Request B 专项验证（参考土豆兄弟）====');
pass.forEach(p => console.log('  [PASS] ' + p));
fail.forEach(f => console.log('  [FAIL] ' + f));
console.log(`通过 ${pass.length} / 失败 ${fail.length}`);
process.exit(fail.length ? 1 : 0);
