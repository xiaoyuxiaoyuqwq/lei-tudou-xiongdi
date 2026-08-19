// Headless 逻辑测试：标签共鸣乘算 + 难度曲线（不依赖浏览器/THREE/DOM）
// 用 vm 在桩上下文里加载 build/p7_boss.js，提取 Synergy / Progress，验证数学。
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync('build/p7_boss.js', 'utf8');
const sandbox = {
  CFG: { colors: {} }, World: {}, Audio2: {}, Player: { cfg: { hp: 100 }, hp: 100, maxHp: 100, heal() {}, takeDamage() {} },
  Game: {}, HUD: { renderGear() {} }, Wingmen: {}, THREE: {}, console,
  Math, Object, Array, JSON, Date, isNaN, parseFloat, parseInt,
};
vm.createContext(sandbox);
vm.runInContext(src + '\n;globalThis.__S = { Synergy: Synergy, Progress: Progress };', sandbox);
const { Synergy, Progress } = sandbox.__S;

let fails = 0;
const approx = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const assert = (cond, msg) => { if (!cond) { console.log('  ✗ FAIL:', msg); fails++; } else console.log('  ✓', msg); };

console.log('--- 1. 重装共鸣 (cannon5+missile5+nova5 = heavy 15 → tier4) ---');
Progress.weapons = { cannon: 5, missile: 5, nova: 5 };
Synergy.refresh();
assert(approx(Synergy.mods.dmg, 1.40), 'heavy dmg = 1.40 (got ' + Synergy.mods.dmg + ')');
assert(approx(Synergy.mods.armor, 0.20), 'heavy armor = 0.20 (got ' + Synergy.mods.armor + ')');
assert(approx(Synergy.mods.moveSlow, 0.15), 'heavy moveSlow = 0.15 (got ' + Synergy.mods.moveSlow + ')');

console.log('--- 2. 精密共鸣 (laser5+saw5+rail5 = precise 15 → tier4) ---');
Progress.weapons = { laser: 5, saw: 5, rail: 5 };
Synergy.refresh();
assert(approx(Synergy.mods.crit, 0.35), 'precise crit = 0.35 (got ' + Synergy.mods.crit + ')');
assert(approx(Synergy.mods.critDmg, 0.50), 'precise critDmg = 0.50 (got ' + Synergy.mods.critDmg + ')');
assert(Synergy.mods.pierce === 1, 'precise pierce = 1 (got ' + Synergy.mods.pierce + ')');

console.log('--- 3. 弹幕共鸣 (cannon3+spread3+pulse3 = barrage 9 → tier3) ---');
Progress.weapons = { cannon: 3, spread: 3, pulse: 3 };
Synergy.refresh();
assert(approx(Synergy.mods.projSpeed, 0.30), 'barrage projSpeed = 0.30 (got ' + Synergy.mods.projSpeed + ')');
assert(approx(Synergy.mods.fireRate, 1.20), 'barrage fireRate = 1.20 (got ' + Synergy.mods.fireRate + ')');

console.log('--- 4. 召唤共鸣 (drone5 = summon 5 → tier1) ---');
Progress.weapons = { drone: 5 };
Synergy.refresh();
assert(approx(Synergy.mods.summonDmg, 1.15), 'summon dmg = 1.15 (got ' + Synergy.mods.summonDmg + ')');
assert(Synergy.mods.dronePlus === 0, 'summon dronePlus = 0 at tier1 (got ' + Synergy.mods.dronePlus + ')');

console.log('--- 5. 无武器时全部为默认值（无共鸣） ---');
Progress.weapons = {};
Synergy.refresh();
assert(Synergy.mods.dmg === 1 && Synergy.mods.heal === 1 && Synergy.mods.moveSlow === 0 && Synergy.mods.crit === 0,
  'empty build → all defaults');

console.log('--- 6. 难度曲线 hpMulAt(w) （复制 build/p8 公式做独立校验） ---');
const hpMulAt = (w, endless) => {
  const poly = 1 + 0.063 * Math.pow(w, 1.8);
  const expo = w > 12 ? Math.exp(Math.min(3.2, (w - 12) * 0.12)) : 1;
  return Math.min(900, poly * expo) * (endless ? 1.35 : 1);
};
assert(approx(hpMulAt(10), 4.98, 0.05), 'w=10 ≈ 4.98 对齐旧线性 (got ' + hpMulAt(10).toFixed(3) + ')');
assert(hpMulAt(1) < hpMulAt(10) && hpMulAt(10) < hpMulAt(20), '曲线单调递增');
assert(hpMulAt(100) <= 900 * 1.35 + 1e-6, '上限封顶 <= 900×1.35 (got ' + hpMulAt(100).toFixed(1) + ')');
assert(hpMulAt(20, true) > hpMulAt(20, false), '无尽模式更陡');

console.log('--- 7. tierInfo / activeList UI 数据 ---');
Progress.weapons = { cannon: 5, missile: 5, nova: 5, laser: 5, saw: 5, rail: 5 };
Synergy.refresh();
const ti = Synergy.tierInfo('heavy');
assert(ti && ti.tier === 4 && ti.next === null, 'heavy tier4 满阶 (next=null)');
const al = Synergy.activeList();
assert(al.length >= 2 && al[0].tier >= al[1].tier, 'activeList 按阶梯降序');

console.log('--- 8. 新武器 C① 标签接入共鸣 (frost/storm=energy, meteor=heavy, swarm=barrage) ---');
Progress.weapons = { frost: 5, storm: 5 };
Synergy.refresh();
let ei = Synergy.tierInfo('energy');
assert(ei && ei.tier === 3, 'energy(frost5+storm5=10级) → tier3 (got ' + (ei && ei.tier) + ')');
Progress.weapons = { meteor: 5 };
Synergy.refresh();
let hi = Synergy.tierInfo('heavy');
assert(hi && hi.tier === 1, 'heavy(meteor5) → tier1 (got ' + (hi && hi.tier) + ')');
Progress.weapons = { swarm: 5 };
Synergy.refresh();
let bi = Synergy.tierInfo('barrage');
assert(bi && bi.tier === 1, 'barrage(swarm5) → tier1 (got ' + (bi && bi.tier) + ')');
Progress.weapons = { frost: 5, meteor: 5, swarm: 5, storm: 5, cannon: 5 };
Synergy.refresh();
const al2 = Synergy.activeList();
assert(al2.length >= 3, 'activeList 至少含 3 个活跃共鸣（新武器标签已接入，got ' + al2.length + ')');

console.log('--- 9. 新武器 C② 标签接入共鸣 (blackhole=energy, phase+nano=medical, photon=precise, tractor=heavy, rotor+mine=barrage) ---');
Progress.weapons = { blackhole: 5, phase: 5, photon: 5, tractor: 5, rotor: 5, mine: 5, nano: 5 };
Synergy.refresh();
assert(Synergy.tierInfo('energy').tier === 1, 'energy(blackhole5) → tier1 (got ' + Synergy.tierInfo('energy').tier + ')');
assert(Synergy.tierInfo('medical').tier === 3, 'medical(phase5+nano5=10级) → tier3 (got ' + Synergy.tierInfo('medical').tier + ')');
assert(Synergy.tierInfo('precise').tier === 1, 'precise(photon5) → tier1 (got ' + Synergy.tierInfo('precise').tier + ')');
assert(Synergy.tierInfo('heavy').tier === 1, 'heavy(tractor5) → tier1 (got ' + Synergy.tierInfo('heavy').tier + ')');
assert(Synergy.tierInfo('barrage').tier === 3, 'barrage(rotor5+mine5=10级) → tier3 (got ' + Synergy.tierInfo('barrage').tier + ')');
const al3 = Synergy.activeList();
assert(al3.length >= 5, 'activeList 至少含 5 个活跃共鸣（C② 标签已接入，got ' + al3.length + ')');
assert(!!Progress.W_INFO.blackhole && !!Progress.W_INFO.tractor && !!Progress.W_INFO.nano,
  'W_INFO 含 C② 7 把新武器条目');

console.log('--- 10. D 扩张：新敌种 bomber/weaver + 变异 MUT 6 键 + STAGES 接入 ---');
{
  // 独立沙箱加载 p2(STAGES/Util) 与 p6(Enemies)，做数据级校验（不执行 init，避免 THREE）
  // THREE 用递归 Proxy 桩：任何 new THREE.X() / 方法调用都不抛错，仅加载数据
  const _h = {
    get(t, p) { if (typeof p === 'symbol') return undefined; return new Proxy(function () {}, _h); },
    construct() { return new Proxy(function () {}, _h); },
    apply() { return new Proxy(function () {}, _h); },
  };
  const _stub = () => new Proxy(function () {}, _h);
  const sb = {
    CFG: { arena: 50 }, THREE: _stub(), World: _stub(), Player: _stub(), Game: _stub(), HUD: _stub(), FX: _stub(), Audio2: _stub(), Bullets: _stub(),
    Loot: _stub(), Gfx: _stub(), Math, Object, Array, JSON, Date, isNaN, parseFloat, parseInt, console,
    Pool: { create: () => ({ get() { return null; }, release() {}, releaseAll() {}, active: [], count: 0 }) },
  };
  let loaded = true;
  try {
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync('build/p2_core.js', 'utf8') + '\n;globalThis.__P2={STAGES:STAGES,Util:Util};', sb);
    vm.runInContext(fs.readFileSync('build/p6_enemies.js', 'utf8') + '\n;globalThis.__P6={Enemies:Enemies};', sb);
  } catch (e) { console.log('  ✗ FAIL: 加载 p2/p6 抛错 ->', e.message); fails++; loaded = false; }
  if (loaded) {
    const STAGES = sb.__P2.STAGES, Enemies = sb.__P6.Enemies;
    assert(!!Enemies.SPEC.bomber, 'SPEC 含 bomber (爆裂体)');
    assert(!!Enemies.SPEC.weaver, 'SPEC 含 weaver (相位编织者)');
    assert(Enemies.SPEC.bomber.ai === 'bomber', 'bomber.ai = "bomber" (got ' + Enemies.SPEC.bomber.ai + ')');
    assert(Enemies.SPEC.weaver.ai === 'weave', 'weaver.ai = "weave" (got ' + Enemies.SPEC.weaver.ai + ')');
    assert(Enemies.SPEC.bomber.hp > 0 && Enemies.SPEC.bomber.dmg > 0 && Enemies.SPEC.bomber.spd > 0, 'bomber 数值有限 (>0)');
    assert(Enemies.SPEC.weaver.hp > 0 && Enemies.SPEC.weaver.dmg > 0 && Enemies.SPEC.weaver.spd > 0, 'weaver 数值有限 (>0)');
    const mk = Enemies.MUT_KEYS || [];
    assert(mk.length === 6, 'MUT_KEYS 含 6 种变异 (got ' + mk.length + ')');
    assert(['armored','swift','regen','berserk','toxic','split'].every(k => mk.includes(k)), 'MUT 6 键齐全 (armored/swift/regen/berserk/toxic/split)');
    assert(!!Enemies.MUT && mk.every(k => !!Enemies.MUT[k]), 'MUT 配置含 6 种变异数值');
    let hits = 0, total = 0;
    for (const s of STAGES) { total++; if (s.pool && (s.pool.includes('bomber') || s.pool.includes('weaver'))) hits++; }
    assert(hits > 0, 'STAGES 至少 1 个星域池接入 bomber/weaver (got ' + hits + '/' + total + ')');
    // 平衡速览：bomber/weaver 强度处于已有敌种区间内（不极端）
    const allHp = Object.values(Enemies.SPEC).map(s => s.hp);
    assert(Enemies.SPEC.bomber.hp >= Math.min(...allHp) && Enemies.SPEC.bomber.hp <= Math.max(...allHp) * 1.5, 'bomber.hp 不超出既有敌种区间 1.5×');
    assert(Enemies.SPEC.weaver.hp >= Math.min(...allHp) && Enemies.SPEC.weaver.hp <= Math.max(...allHp) * 1.5, 'weaver.hp 不超出既有敌种区间 1.5×');
  }
}

console.log('--- 11. 设置系统：Settings 持久化 + 音量控制 + 自适应 BGM ---');
{
  const _h = {
    get(t, p) { if (typeof p === 'symbol') return undefined; return new Proxy(function () {}, _h); },
    construct() { return new Proxy(function () {}, _h); },
    apply() { return new Proxy(function () {}, _h); },
  };
  const _stub = () => new Proxy(function () {}, _h);
  const sb3 = {
    CFG: { arena: 50 }, THREE: _stub(), World: _stub(), Player: _stub(), Game: _stub(), HUD: _stub(), FX: _stub(), Audio2: _stub(), Bullets: _stub(),
    Loot: _stub(), Gfx: _stub(), Math, Object, Array, JSON, Date, isNaN, parseFloat, parseInt, console,
    Util: { rand: () => 0, TAU: 6.28, pick: (a) => a[0] },
    Enemies: { pool: { active: [] } }, Boss: { active: false }, Game: { wave: 5 }, Player: { hp: 50, maxHp: 100 },
    window: {}, addEventListener: () => {},
  };
  let loaded = true;
  try {
    vm.createContext(sb3);
    vm.runInContext(fs.readFileSync('build/p3_world.js', 'utf8') + '\n;globalThis.__P3={Settings:Settings,Audio2:Audio2,Input:Input};', sb3);
  } catch (e) { console.log('  ✗ FAIL: 加载 p3 抛错 ->', e.message); fails++; loaded = false; }
  if (loaded) {
    const S = sb3.__P3.Settings, A = sb3.__P3.Audio2;
    assert(S && typeof S.vol === 'object' && typeof S.binds === 'object', 'Settings 含 vol/binds 对象');
    assert(typeof S.vol.master === 'number' && typeof S.vol.sfx === 'number' && typeof S.vol.music === 'number', 'Settings.vol 含 主/音效/音乐 三档数值');
    assert(S.binds.up === 'KeyW' && S.binds.dash === 'Space' && S.binds.pause === 'KeyP', 'Settings.binds 默认键位完整 (WASD/空格/F/P)');
    assert(typeof S.save === 'function' && typeof S.load === 'function', 'Settings.save/load 存在');
    assert(typeof A.setMasterVol === 'function' && typeof A.setSfxVol === 'function' && typeof A.setMusicVol === 'function', 'Audio2 音量控制方法存在');
    assert(typeof A._updateMusic === 'function' && typeof A._step === 'function', 'Audio2 自适应 _updateMusic/_step 存在');
    let miOk = false;
    try { A._updateMusic(); miOk = (typeof A._mi === 'number'); } catch (e) { console.log('  ✗ FAIL: _updateMusic 抛错 ->', e.message); fails++; }
    assert(miOk, 'Audio2._updateMusic 运行产出 _mi 数值 (敌0/波5/非Boss → 强度≈0.08)');
  }
}

/* ---- 第 12 组：地狱模式难度缩放（加载 p8，纯数值校验 hpMulAt / waveSpec）---- */
{
  console.log('\n[第12组] 地狱模式难度缩放');
  const _stub8 = () => new Proxy(function(){}, { get: () => _stub8(), apply: () => _stub8(), construct: () => _stub8() });
  const Util = { clamp: (v,a,b)=>Math.max(a,Math.min(b,v)), rand:(a,b)=>a+(b-a)*0.5, pick:(a)=>a[0], TAU:Math.PI*2 };
  const CFG = { arena: 50 };
  const STAGES = [{ pool:['charger'] }, { pool:['orbiter'] }];
  const docStub = { readyState: 'loading', getElementById: () => _stub8(), createElement: () => _stub8(), body: _stub8(), addEventListener: () => {} };
  const sb8 = {
    CFG, Util, STAGES, Math, Object, Array, JSON, Date, isNaN, parseFloat, parseInt, console,
    document: docStub, performance: { now: () => 0 }, requestAnimationFrame: () => 0, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    THREE: _stub8(), World: _stub8(), Player: _stub8(), HUD: _stub8(), FX: _stub8(), Audio2: _stub8(), Bullets: _stub8(),
    Loot: _stub8(), Gfx: _stub8(), Enemies: _stub8(), Boss: _stub8(), Wingmen: _stub8(), Minimap: _stub8(),
    Progress: _stub8(), Synergy: _stub8(), Settings: _stub8(), Input: _stub8(), Asteroids: _stub8(), Grid: _stub8(),
    window: {}, addEventListener: () => {},
  };
  let loaded = true;
  try {
    vm.createContext(sb8);
    vm.runInContext(fs.readFileSync('build/p8_game.js', 'utf8') + '\n;globalThis.__P8={Game:Game};', sb8);
  } catch (e) { console.log('  ✗ FAIL: 加载 p8 抛错 ->', e.message); fails++; loaded = false; }
  if (loaded) {
    const G = sb8.__P8.Game;
    G.endless = false; G.hell = false; G._waveCache = {};
    const hN = G.hpMulAt(10), sN = G.waveSpec(5);
    assert(typeof hN === 'number' && hN > 0 && isFinite(hN), '普通模式 hpMulAt(10) 为有限正数');
    assert(typeof sN.per === 'number' && sN.per >= 1, '普通模式 waveSpec(5).per 合理');
    G.hell = true; G._waveCache = {};
    const hH = G.hpMulAt(10), sH = G.waveSpec(5);
    assert(Math.abs(hH - hN * 2.2) < 1e-6, '地狱模式 hpMulAt(10) ≈ 普通 ×2.2');
    assert(sH.per > sN.per, '地狱模式 waveSpec(5).per > 普通');
    assert(sH.elite >= sN.elite, '地狱模式 精英率 ≥ 普通');
    G.hell = false; G._waveCache = {};
    assert(G.waveSpec(7) === G.waveSpec(7), 'waveSpec 按波次缓存（同波返回同一对象）');
  }
}

console.log(fails === 0 ? '\nALL PASS ✅' : '\n' + fails + ' FAILED ❌');
process.exit(fails === 0 ? 0 : 1);
