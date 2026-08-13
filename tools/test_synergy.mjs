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

console.log(fails === 0 ? '\nALL PASS ✅' : '\n' + fails + ' FAILED ❌');
process.exit(fails === 0 ? 0 : 1);
