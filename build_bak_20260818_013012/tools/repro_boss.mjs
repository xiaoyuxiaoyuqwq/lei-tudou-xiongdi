/* 离线复现 boss 报错：真实 three.js + 桩替换 WebGLRenderer，实跑游戏逻辑直到 boss 出现。
   用法：node tools/repro_boss.mjs [hell] */
import fs from 'fs';
import vm from 'vm';

/* ---------- DOM / 浏览器 API 桩 ---------- */
const gradientStub = { addColorStop(){}, };
function makeCtx2D(){
  return new Proxy({}, {
    get(t,p){
      if(p in t) return t[p];
      if(p==='createRadialGradient'||p==='createLinearGradient'||p==='createPattern') return ()=>gradientStub;
      if(p==='canvas') return { width:1280, height:720 };
      if(p==='getImageData') return ()=>({ data:new Uint8ClampedArray(4) });
      if(p==='measureText') return ()=>({ width:0 });
      return (typeof p==='string') ? (()=>{}) : undefined;
    },
    set(t,p,v){ t[p]=v; return true; }
  });
}
function makeEl(tag){
  const el = {
    tagName: tag||'div',
    style: new Proxy({}, {get:(t,p)=>t[p]||'', set:(t,p,v)=>{t[p]=v;return true;}}),
    classList: { _s:new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
      toggle(c,f){ if(f===undefined){ this._s.has(c)?this._s.delete(c):this._s.add(c);} else { f?this._s.add(c):this._s.delete(c);} }, contains(c){return this._s.has(c);} },
    children: [],
    dataset: {},
    addEventListener(){}, removeEventListener(){},
    appendChild(c){ this.children.push(c); return c; },
    insertBefore(c){ this.children.push(c); return c; },
    removeChild(){}, setAttribute(){}, getAttribute(){return null;},
    querySelector(){ return makeEl(); }, querySelectorAll(){ return []; },
    getContext(){ return makeCtx2D(); },
    getBoundingClientRect(){ return {left:0,top:0,width:1280,height:720}; },
    focus(){}, blur(){},
    get firstChild(){ return this.children[0]||null; },
    get parentNode(){ return null; },
  };
  el._text=''; el._html='';
  Object.defineProperty(el,'textContent',{get(){return this._text;},set(v){this._text=v;}});
  Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}});
  Object.defineProperty(el,'width',{get(){return 1280;},set(){}});
  Object.defineProperty(el,'height',{get(){return 720;},set(){}});
  return el;
}
const documentStub = {
  getElementById(){ return makeEl(); },
  createElement(tag){ return makeEl(tag); },
  createElementNS(){ return makeEl(); },
  body: makeEl('body'),
  addEventListener(){}, removeEventListener(){},
  querySelector(){ return makeEl(); },
  documentElement: makeEl('html'), head: makeEl('head'),
};
function makeAudioNode(){
  return new Proxy({}, { get(t,p){
    if(p==='connect'||p==='start'||p==='stop'||p==='disconnect') return ()=>{};
    if(p==='frequency'||p==='gain'||p==='q'||p==='detune') return {value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}};
    if(p==='currentTime') return 0;
    if(p==='destination') return makeAudioNode();
    return ()=>makeAudioNode();
  }});
}
function AudioContextStub(){
  return {
    currentTime:0, sampleRate:44100, destination: makeAudioNode(),
    createOscillator(){ return makeAudioNode(); }, createGain(){ return makeAudioNode(); },
    createBiquadFilter(){ return makeAudioNode(); }, createAnalyser(){ return makeAudioNode(); },
    createBufferSource(){ return makeAudioNode(); },
    createBuffer(){ return { getChannelData(){ return new Float32Array(8); } }; },
    resume(){}, suspend(){},
  };
}

/* ---------- vm 上下文 ---------- */
const ctx = {};
ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
ctx.console = console;
ctx.Math=Math; ctx.Date=Date; ctx.JSON=JSON; ctx.Object=Object; ctx.Array=Array;
ctx.Float32Array=Float32Array; ctx.Uint16Array=Uint16Array; ctx.Uint32Array=Uint32Array;
ctx.Int16Array=Int16Array; ctx.ArrayBuffer=ArrayBuffer; ctx.Uint8Array=Uint8Array;
ctx.String=String; ctx.Number=Number; ctx.Boolean=Boolean;
ctx.parseInt=parseInt; ctx.parseFloat=parseFloat; ctx.isNaN=isNaN; ctx.isFinite=isFinite;
ctx.setTimeout=setTimeout; ctx.clearTimeout=clearTimeout; ctx.setInterval=setInterval; ctx.clearInterval=clearInterval;
ctx.innerWidth=1280; ctx.innerHeight=720; ctx.devicePixelRatio=1;
ctx.performance={ now:()=>Date.now() };
ctx.requestAnimationFrame=()=>0; ctx.cancelAnimationFrame=()=>{};
ctx.document=documentStub;
ctx.AudioContext=AudioContextStub; ctx.webkitAudioContext=AudioContextStub;
ctx.navigator={ userAgent:'node', platform:'node' };
ctx.localStorage={ _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
ctx.addEventListener=()=>{}; ctx.removeEventListener=()=>{};
ctx.atob=(s)=>Buffer.from(s,'base64').toString('binary');
ctx.btoa=(s)=>Buffer.from(s,'binary').toString('base64');

vm.createContext(ctx);

/* ---------- 加载真实 three.js ---------- */
const threeSrc = fs.readFileSync('three.min.js','utf8');
vm.runInContext(threeSrc, ctx, {filename:'three.js'});
// 用桩替换 WebGLRenderer（避免需要真实 WebGL 上下文）
ctx.THREE.WebGLRenderer = class {
  constructor(){ this.domElement = makeEl('canvas'); this.shadowMap={enabled:false}; this.info={render:{}}; }
  setPixelRatio(){} setSize(){} render(){} setClearColor(){} setAnimationLoop(){} dispose(){}
};

/* ---------- 提取 index.html 内的游戏脚本（#4） ---------- */
const html = fs.readFileSync('index.html','utf8');
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks=[];
while((m=re.exec(html))){ const c=m[1]; if(c.trim().length<50) continue; blocks.push(c); }
console.log('inline scripts found:', blocks.length);
// blocks: [0]=errorHandler, [1]=three(inlined, 已单独加载), [2]=meshes, [3]=game
vm.runInContext(blocks[2], ctx, {filename:'meshes.js'});
console.log('MESHES keys:', ctx.MESHES ? Object.keys(ctx.MESHES).length : '(undefined!)');
const gameSrc = blocks[3] +
  '\n;globalThis.__G = { Game, Boss, Player, Player2, Enemies, Weapons, Weapons2, Progress, Progress2, World, FX, HUD, Synergy, CFG, Loot, Bullets, Wingmen, Audio2, Mesh, Util, Hazards };';
vm.runInContext(gameSrc, ctx, {filename:'game.js'});

/* ---------- 实跑 ---------- */
const Game = ctx.__G.Game, Boss = ctx.__G.Boss, Player = ctx.__G.Player, Progress = ctx.__G.Progress;
const Player2 = ctx.__G.Player2, Weapons2 = ctx.__G.Weapons2, Progress2 = ctx.__G.Progress2;
const Enemies = ctx.__G.Enemies, Hazards = ctx.__G.Hazards;
const Loot = ctx.__G.Loot, Wingmen = ctx.__G.Wingmen;
const hell = process.argv[2] === 'hell' || process.argv[3] === 'hell';
const coop = process.argv[2] === 'coop' || process.argv[3] === 'coop';
try {
  Game.init();
} catch(e){ console.error('Game.init threw:', e.stack); process.exit(1); }

Game.start(false, hell, coop);
// 注入 E+ 全部新武器，确保 radial/reflect/lance/pulsar/siege/scatter/ion 的代码路径被执行
for (const wk of ['radial','reflect','lance','pulsar','siege','scatter','ion']) Progress.weapons[wk] = 3;
// 双人：双方各自注入新武器，覆盖 P2 独立武器集（Weapons2）代码路径
if (coop){
  console.log('>> 双人模式：Player2 =', !!Player2, ' Weapons2 =', !!Weapons2, ' Progress2 =', !!Progress2,
    ' players =', Game.players.length);
  for (const p of [Player, Player2]){
    for (const wk of ['radial','reflect','lance','pulsar','siege','scatter','ion']) p.progress.weapons[wk] = 3;
    if (p.weapons && p.weapons.reset) p.weapons.reset();
  }
}
// 注入三种新僚机（护卫舰/拦截机/哨戒舰），跑其开火分支
Wingmen.add('cruiser'); Wingmen.add('interceptor'); Wingmen.add('sentinel');
// 注入战帅（小Boss），跑其 ai 分支（环形弹幕 + 蓄力突进）
Enemies.spawn('warlord', Player.x + 12, Player.z + 12, 1, 1, 2.4, false, null);
// 强制刷「友军炮台立场」+「维修立场」，覆盖双性质场景触发（友军开火 / 回血）新代码路径
Hazards._mk('rally');
Hazards._mk('repair');
Game.last = 1000;            // 让 dt 计算从干净起点开始

const dtMs = 100;
let t = 1000, frames = 0, bossSeen = false, phase2Seen = false, testedB = false;
const maxFrames = 30000;
let lastErr = null;
while(frames < maxFrames){
  t += dtMs;
  try {
    Game.frame(t);
  } catch(err){
    console.error('\n!!! 异常 @ frame', frames, 'time', Game.time.toFixed(1),
      'state', Game.state, 'bossActive', Boss.active, 'bossEntering', Boss.entering,
      'bossPhase', Boss.phase, '\n', err.stack);
    process.exit(2);
  }
  // 升级选卡界面：自动选第一张继续，避免卡在 LEVELUP
  if(Game.state === 'LEVELUP'){
    try { Game.pickCard(0); } catch(e){ console.error('pickCard 异常:', e.stack); process.exit(3); }
  }
  // 让玩家在复现中保持存活（无人工操作），专注于把流程推进到 BOSS 并跑完其生命周期
  if(Player.hp < Player.maxHp) Player.hp = Player.maxHp;
  if(coop && Player2 && !Player2._dead && Player2.hp < Player2.maxHp) Player2.hp = Player2.maxHp;
  if(Boss.active && !bossSeen){ bossSeen=true; console.log('>> Boss 出现 @ frame', frames, 'time', Game.time.toFixed(1), 'hp', Boss.maxHp); }
  // 玩家武器不锁 boss（无人工瞄准），手动造成伤害以逼出 阶段II / 冲撞 / 死亡 路径
  if(bossSeen && Boss.active && frames % 60 === 0){
    try { Boss.damage(2200, false, Boss.x, Boss.z); } catch(e){ console.error('Boss.damage 异常:', e.stack); process.exit(4); }
  }
  if(Boss.active && Boss.phase===2 && !phase2Seen){ phase2Seen=true; console.log('>> Boss 进入阶段II @ frame', frames); }
  // 把存活 boss 切换为第二形态 B（虚空巨像），覆盖 nova 震荡波 + B 专属配色/攻击分支
  if(bossSeen && Boss.active && !testedB && phase2Seen){
    testedB = true;
    Boss.variant = 'B';
    Boss.tint = 0x49e0ff; Boss.tint2 = 0xb980ff; Boss.tintHex = '#49e0ff'; Boss.tint2Hex = '#b980ff';
    Boss.name = '虚空巨像 VOID-Ξ'; Boss.r = 6.2;
    if (Boss._recolor) Boss._recolor();
    console.log('>> 切换为第二形态 B @ frame', frames);
  }
  // 周期掉落太空补给箱（覆盖 Loot.dropItem + 吸附 + _collect 各 kind 路径）
  if(frames % 90 === 0) Loot.dropItem(Player.x + 0.4, Player.z);
  // 触发一次 EMP 鱼雷（覆盖 Enemies.emp + 全场 stun + 静默 damage 路径）
  if(frames === 300) Enemies.emp();
  if((Game.state === 'GAMEOVER') && frames>5){ console.log('>> 游戏结束:', Game.state, '@ frame', frames, 'time', Game.time.toFixed(1)); break; }
  // boss 完整生命周期（出现→阶段II→变体B→被击破）已跑完即提前结束，
  // 避免后续上万帧空跑在地狱高密度下耗尽测试机内存（非游戏逻辑问题）
  if(testedB && !Boss.active && frames > 13000){ console.log('>> boss 已击破，提前结束 @ frame', frames); break; }
  frames++;
}
console.log('\n=== 完成 ===');
console.log('frames', frames, 'time', Game.time.toFixed(1), 'state', Game.state,
  'bossActive', Boss.active, 'bossSeen', bossSeen, 'phase2Seen', phase2Seen,
  'playerHP', Math.round(Player.hp), '/', Math.round(Player.maxHp), 'kills', Game.kills);
if(coop){
  console.log('coop players =', Game.players.length,
    ' P1 HP', Math.round(Player.hp) + '/' + Math.round(Player.maxHp),
    ' P2 HP', Player2 ? (Math.round(Player2.hp) + '/' + Math.round(Player2.maxHp)) : 'N/A',
    ' P2 alive', Player2 ? !Player2._dead : 'N/A',
    ' Weapons2.cd keys', Weapons2 ? Object.keys(Weapons2.cd).length : 'N/A');
}
