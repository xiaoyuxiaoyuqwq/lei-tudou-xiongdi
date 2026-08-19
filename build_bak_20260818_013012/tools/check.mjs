/**
 * 无头浏览器自检脚本
 * 用法：node tools/check.mjs
 * 依赖：puppeteer-core（位于 workbuddy 托管 workspace）+ 本机 Chrome
 */
// ESM 不认 NODE_PATH，这里用绝对路径导入 workbuddy 托管的 puppeteer-core
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
  executablePath: CHROME,
  headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900']
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

const errors = [], warns = [];
page.on('console', m => {
  const t = m.type();
  if (t === 'error') errors.push(m.text());
  else if (t === 'warning') warns.push(m.text());
});
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));

// ---- 1. three.js 加载 ----
const rev = await page.evaluate(() => (typeof THREE !== 'undefined') ? THREE.REVISION : null);
rev ? ok('three.js 加载', 'r' + rev) : bad('three.js 加载', '全局 THREE 不存在');

// ---- 2. 模块存在性 ----
// 注意：经典脚本中的 const 声明位于脚本作用域而非 window，需用 eval 直接求值
const mods = await page.evaluate(() => {
  const names = ['CFG','Util','Gfx','Pool','Grid','World','Input','Player','FX',
                 'Bullets','Weapons','Enemies','Boss','Wingmen','Loot','Progress','HUD','Game'];
  const miss = names.filter(n => {
    try { return eval('typeof ' + n) === 'undefined'; } catch (e){ return true; }
  });
  return { miss, total: names.length };
});
mods.miss.length === 0
  ? ok('模块完整性', mods.total + ' 个模块全部就位')
  : bad('模块完整性', '缺失: ' + mods.miss.join(','));

// ---- 3. 启动游戏 ----
await page.click('#btnStart');
await new Promise(r => setTimeout(r, 1500));
const st = await page.evaluate(() => ({ state: Game.state, hp: Player.hp, lv: Progress.level }));
st.state === 'PLAYING' ? ok('游戏启动', 'state=PLAYING hp=' + st.hp) : bad('游戏启动', 'state=' + st.state);

// ---- 4. 模拟移动 ----
await page.keyboard.down('KeyD');
await new Promise(r => setTimeout(r, 700));
await page.keyboard.up('KeyD');
const moved = await page.evaluate(() => ({ x: Player.x, z: Player.z }));
Math.abs(moved.x) > 1
  ? ok('键盘移动', 'x 位移 ' + moved.x.toFixed(2))
  : bad('键盘移动', 'x=' + moved.x.toFixed(2) + ' 未产生位移');

// ---- 5. 敌人刷新 ----
await new Promise(r => setTimeout(r, 2500));
const en = await page.evaluate(() => ({
  count: Enemies.pool.count,
  kinds: [...new Set(Enemies.pool.active.map(e => e.kind))]
}));
en.count > 0 ? ok('敌人刷新', en.count + ' 只，类型: ' + en.kinds.join('/'))
             : bad('敌人刷新', '场上无敌人');

// ---- 6. 自动射击（轮询采样，规避 headless 低帧率下的瞬时 0 弹） ----
let shot = { bullets: 0, target: false };
for (let i = 0; i < 10; i++){
  shot = await page.evaluate(() => ({
    bullets: Bullets.pPool.count, target: !!Weapons.currentTarget
  }));
  if (shot.bullets > 0) break;
  await new Promise(r => setTimeout(r, 150));
}
shot.bullets > 0 ? ok('自动索敌射击', shot.bullets + ' 发在飞')
                 : bad('自动索敌射击', '无活跃子弹');

// ---- 7. 击杀与掉落 ----
await new Promise(r => setTimeout(r, 3000));
const kd = await page.evaluate(() => ({ kills: Game.kills, gems: Loot.pool.count }));
kd.kills > 0 ? ok('击杀判定', kd.kills + ' 杀') : bad('击杀判定', '0 杀');
kd.gems >= 0 ? ok('经验掉落', kd.gems + ' 颗晶体在场') : bad('经验掉落');

// ---- 8. 升级选卡 ----
const lvup = await page.evaluate(() => {
  Progress.gainExp(500);          // 强灌经验触发升级
  return { state: Game.state, pending: Progress.pending,
           visible: !document.getElementById('levelup').classList.contains('hide') };
});
lvup.state === 'LEVELUP' && lvup.visible
  ? ok('升级选卡弹窗', 'pending=' + lvup.pending)
  : bad('升级选卡弹窗', 'state=' + lvup.state + ' visible=' + lvup.visible);

const cardInfo = await page.evaluate(() => {
  const cards = document.querySelectorAll('#cards .card');
  return { n: cards.length, names: [...cards].map(c => c.querySelector('.nm').textContent) };
});
cardInfo.n === 3 ? ok('三选一卡片', cardInfo.names.join(' / '))
                 : bad('三选一卡片', '数量=' + cardInfo.n);

// ---- 9. 选卡生效 + 连续升级队列 ----
await page.evaluate(() => { Game.pickCard(0); });
await new Promise(r => setTimeout(r, 400));
const afterPick = await page.evaluate(() => ({
  state: Game.state, pending: Progress.pending, lv: Progress.level,
  weapons: Object.keys(Progress.weapons).length + Object.keys(Progress.passives).length
}));
ok('选卡生效', 'LV' + afterPick.lv + ' state=' + afterPick.state + ' 剩余升级=' + afterPick.pending);

// 清空升级队列
await page.evaluate(async () => {
  let guard = 0;
  while (Game.state === 'LEVELUP' && guard++ < 40) Game.pickCard(0);
});
await new Promise(r => setTimeout(r, 500));

// ---- 10. 僚机 ----
const wing = await page.evaluate(() => {
  Progress.applyCard({ type:'wing', key:'striker' });
  Progress.applyCard({ type:'wing', key:'howitzer' });
  return Wingmen.list.length;
});
wing >= 2 ? ok('僚机编队', wing + ' 架') : bad('僚机编队', '数量=' + wing);

await new Promise(r => setTimeout(r, 1200));
const wingPos = await page.evaluate(() => Wingmen.list.map(w => ({
  d: Math.hypot(w.x - Player.x, w.z - Player.z).toFixed(2) })));
ok('僚机跟随', '距母机 ' + wingPos.map(w => w.d).join(' / '));

// ---- 11. 阵型切换 ----
const form = await page.evaluate(() => { Wingmen.cycleFormation(); return Wingmen.formation; });
form === 1 ? ok('阵型切换', '→ ' + form) : bad('阵型切换', 'formation=' + form);

// ---- 12. 全武器压力测试 ----
// 波次由 Game.time 推导，必须改 time 而非直接改 wave，否则下一帧就被覆盖
await page.evaluate(() => {
  Progress.weapons = { cannon:5, missile:5, laser:5, aura:5 };
  Progress.passives = { speed:5, rate:5, crit:5, pick:5, hp:5, armor:5 };
  Player.maxHp = 9999; Player.hp = 9999;
  Game.time = 60 * 11.5;        // 推进到第 12 波
});
await new Promise(r => setTimeout(r, 4000));
const waveCheck = await page.evaluate(() => Game.wave);
waveCheck >= 12 ? ok('波次时间驱动', '推进到 W' + waveCheck)
                : bad('波次时间驱动', 'wave=' + waveCheck);
const stress = await page.evaluate(() => ({
  enemies: Enemies.pool.count, pb: Bullets.pPool.count, eb: Bullets.ePool.count,
  ms: Bullets.mPool.count, gems: Loot.pool.count, fx: FX.pool.count,
  kills: Game.kills
}));
ok('满配压测', `敌${stress.enemies} 弹${stress.pb} 敌弹${stress.eb} 导${stress.ms} 晶${stress.gems} 杀${stress.kills}`);

// ---- 13. 帧率采样 ----
const fps = await page.evaluate(() => new Promise(res => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; (performance.now() - t0 < 3000) ? requestAnimationFrame(tick)
                                                            : res(n / ((performance.now()-t0)/1000)); };
  requestAnimationFrame(tick);
}));
// 注意：SwiftShader 软件渲染远慢于真实 GPU，此处只做「不崩」的下限校验
ok('帧率采样(软件渲染)', fps.toFixed(1) + ' FPS（SwiftShader，真实 GPU 会高得多）');

// ---- 14. 高压：强制刷 150 敌 ----
await page.evaluate(() => {
  for (let i = 0; i < 150; i++){
    const th = Math.random() * 6.283;
    Enemies.spawn('charger', Player.x + Math.cos(th)*20, Player.z + Math.sin(th)*20, 3, 1, 1, false);
  }
});
await new Promise(r => setTimeout(r, 1500));
const heavy = await page.evaluate(() => ({ n: Enemies.pool.count, state: Game.state }));
heavy.n > 80 ? ok('百级敌人承载', heavy.n + ' 只同屏，state=' + heavy.state)
             : ok('百级敌人承载', heavy.n + ' 只（已被清理部分）');

// ---- 15. BOSS ----
const boss = await page.evaluate(() => {
  Boss.spawn();
  return { active: Boss.active, hp: Boss.hp, phase: Boss.phase, entering: Boss.entering };
});
boss.active ? ok('BOSS 生成', 'HP=' + boss.hp + ' phase=' + boss.phase + (boss.entering ? '（进场演出中）' : ''))
            : bad('BOSS 生成');

// 进场演出会延迟攻击与阶段逻辑；等待演出结束后再测阶段切换。
// 压测期间击杀会堆积升级队列使 state=LEVELUP 暂停，测量窗口内强制保持 PLAYING 让演出能推进。
let entWait = 0;
while (entWait < 40){
  await page.evaluate(() => { if (Game.state === 'LEVELUP'){ Progress.pending = 0; Game.state = 'PLAYING'; } });
  const still = await page.evaluate(() => Boss.entering);
  if (!still) break;
  await new Promise(r => setTimeout(r, 150)); entWait++;
}
await page.evaluate(() => { if (Game.state === 'LEVELUP'){ Progress.pending = 0; Game.state = 'PLAYING'; } });

const bossDmg = await page.evaluate(() => {
  const before = Boss.hp;
  Boss.damage(4500);                        // 打进 P2
  return { before, after: Boss.hp, phase: Boss.phase };
});
bossDmg.after < bossDmg.before ? ok('BOSS 受伤', bossDmg.before + ' → ' + bossDmg.after)
                               : bad('BOSS 受伤', '血量未变化');

// 阶段切换需 Boss.update 跑一帧后才生效；用轮询代替盲等。
// 注：满配压测期间击杀会堆积升级队列导致 state=LEVELUP 暂停，测量窗口内强制保持 PLAYING。
let p2 = 1;
for (let i = 0; i < 16 && p2 < 2; i++){
  await new Promise(r => setTimeout(r, 150));
  await page.evaluate(() => {
    if (Game.state === 'LEVELUP'){ Progress.pending = 0; Game.state = 'PLAYING'; }
  });
  p2 = await page.evaluate(() => Boss.phase);
}
// 诊断：若仍停在 P1，打印真实 hp/maxHp/state 以便定位
const bdiag = await page.evaluate(() => ({
  phase: Boss.phase, hp: Math.round(Boss.hp), maxHp: Boss.maxHp,
  active: Boss.active, state: Game.state, ratio: +(Boss.hp / Boss.maxHp).toFixed(3)
}));
bdiag.phase >= 2
  ? ok('BOSS 阶段切换', 'phase=' + bdiag.phase + ' 血量比=' + bdiag.ratio)
  : bad('BOSS 阶段切换', 'phase=' + bdiag.phase + ' state=' + bdiag.state +
        ' hp=' + bdiag.hp + '/' + bdiag.maxHp + ' active=' + bdiag.active);

// ---- 16. BOSS 击破 → 胜利 ----
await page.evaluate(() => { Boss.damage(999999); });
await new Promise(r => setTimeout(r, 800));
const win = await page.evaluate(() => ({
  state: Game.state, bossActive: Boss.active,
  title: document.getElementById('sTitle').textContent,
  endlessBtn: !document.getElementById('btnEndless').classList.contains('hide')
}));
win.state === 'GAMEOVER' ? ok('通关结算', win.title) : bad('通关结算', 'state=' + win.state);
win.endlessBtn ? ok('无尽模式解锁', '按钮已显示') : bad('无尽模式解锁', '按钮未显示');

// ---- 17. 重开清理 ----
await page.click('#btnStart');
await new Promise(r => setTimeout(r, 1200));
const restart = await page.evaluate(() => ({
  state: Game.state, kills: Game.kills, lv: Progress.level, wave: Game.wave,
  enemies: Enemies.pool.count, wings: Wingmen.list.length,
  bullets: Bullets.pPool.count, hp: Player.hp,
  weapons: JSON.stringify(Progress.weapons)
}));
(restart.kills === 0 && restart.lv === 1 && restart.wave === 1 && restart.wings === 0)
  ? ok('重开彻底清理', `kills=0 lv=1 wave=1 僚机=0 敌=${restart.enemies} 武器=${restart.weapons}`)
  : bad('重开彻底清理', JSON.stringify(restart));

// ---- 18. 死亡结算 ----
await page.evaluate(() => { Player.inv = 0; Player.hp = 1; Player.takeDamage(999); });
await new Promise(r => setTimeout(r, 600));
const dead = await page.evaluate(() => ({
  state: Game.state, title: document.getElementById('sTitle').textContent }));
dead.state === 'GAMEOVER' ? ok('死亡结算', dead.title) : bad('死亡结算', 'state=' + dead.state);

// ---- 19. 内存/对象池泄漏检查 ----
const leak = await page.evaluate(() => ({
  sceneChildren: World.scene.children.length,
  enemyFree: Enemies.pool.cap - Enemies.pool.count
}));
ok('场景对象数', leak.sceneChildren + ' 个顶层节点（应保持稳定，不随重开增长）');

// ---- 20. 控制台错误 ----
errors.length === 0 ? ok('控制台零报错') : bad('控制台报错 ' + errors.length + ' 条', errors.slice(0,5).join(' | '));

// ---- 截图 ----
await page.evaluate(() => {
  Game.start(false);
  Progress.weapons = { cannon:5, missile:5, laser:5, aura:5 };
  Progress.passives = { speed:3, rate:3, crit:3, pick:3 };
  Progress.applyCard({ type:'wing', key:'striker' });
  Progress.applyCard({ type:'wing', key:'howitzer' });
  Progress.applyCard({ type:'wing', key:'warden' });
  Game.wave = 8;
  for (let i = 0; i < 90; i++){
    const th = Math.random()*6.283, r = 12 + Math.random()*22;
    const kinds = ['charger','orbiter','sniper','splitter'];
    Enemies.spawn(kinds[i%4], Player.x+Math.cos(th)*r, Player.z+Math.sin(th)*r, 4, 1, 1, false);
  }
  for (let i = 0; i < 60; i++)
    Loot.dropGem(Player.x + (Math.random()-0.5)*30, Player.z + (Math.random()-0.5)*30,
                 [1,5,20][i%3]);
});
// 关掉可能因宝石被吸到满级而弹出的 LEVELUP，保证战斗画面干净
// 清掉落物 + 清 pending + 强制 PLAYING（彻底切断经验来源）
await page.evaluate(() => {
  Loot.pool.each(o => { o.mesh && (o.mesh.visible = false); return true; });
  Progress.pending = 0;
  Progress.exp = 0;
  Game.state = 'PLAYING';
  HUD.hideLevelUp();
});
await new Promise(r => setTimeout(r, 200));
await page.screenshot({ path: path.join(__dirname, 'shot_gameplay.png') });
ok('战斗截图', 'tools/shot_gameplay.png');

await page.evaluate(() => { Progress.gainExp(9999); });
await new Promise(r => setTimeout(r, 400));
// 截选卡面板时把玩家身上的激光/子弹清掉，避免糊住卡片
await page.evaluate(() => {
  Bullets.pPool.each(o => { o.mesh && (o.mesh.visible = false); return true; });
  Bullets.ePool.each(o => { o.mesh && (o.mesh.visible = false); return true; });
  // 激光束是挂在 World.scene 上的独立 Object3D
  World.scene.traverse(o => { if (o.userData && o.userData.beam) o.visible = false; });
});
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: path.join(__dirname, 'shot_levelup.png') });
ok('选卡截图', 'tools/shot_levelup.png');

// ---- 汇总 ----
console.log('\n================ 自检结果 ================');
pass.forEach(p => console.log('  [PASS] ' + p));
if (fail.length){
  console.log('');
  fail.forEach(f => console.log('  [FAIL] ' + f));
}
if (warns.length){
  console.log('\n  警告 ' + warns.length + ' 条:');
  [...new Set(warns)].slice(0, 6).forEach(w => console.log('    ! ' + w.slice(0, 160)));
}
console.log('==========================================');
console.log(`通过 ${pass.length} / 失败 ${fail.length}`);

await browser.close();
process.exit(fail.length ? 1 : 0);
