/* 确定性校验：bomber/weaver 必须走程序化几何（proc_bomber/proc_weaver），
   而不是掉回默认二十面体。用法：node tools/check_procmodels.mjs */
import fs from 'fs';
import vm from 'vm';

/* ---------- 复用 repro 的浏览器/three 桩 ---------- */
const gradientStub = { addColorStop(){} };
function makeCtx2D(){ return new Proxy({}, { get(t,p){
  if(p in t) return t[p];
  if(p==='createRadialGradient'||p==='createLinearGradient'||p==='createPattern') return ()=>gradientStub;
  if(p==='canvas') return { width:1280, height:720 };
  if(p==='getImageData') return ()=>({ data:new Uint8ClampedArray(4) });
  if(p==='measureText') return ()=>({ width:0 });
  return (typeof p==='string') ? (()=>{}) : undefined;
}, set(t,p,v){ t[p]=v; return true; } }); }
function makeEl(tag){ const el={ tagName:tag||'div',
  style:new Proxy({},{get:(t,p)=>t[p]||'',set:(t,p,v)=>{t[p]=v;return true;}}),
  classList:{_s:new Set(),add(c){this._s.add(c);},remove(c){this._s.delete(c);},toggle(c,f){if(f===undefined){this._s.has(c)?this._s.delete(c):this._s.add(c);}else{f?this._s.add(c):this._s.delete(c);}},contains(c){return this._s.has(c);}},
  children:[],dataset:{},addEventListener(){},removeEventListener(){},appendChild(c){this.children.push(c);return c;},insertBefore(c){this.children.push(c);return c;},
  removeChild(){},setAttribute(){},getAttribute(){return null;},querySelector(){return makeEl();},querySelectorAll(){return [];},getContext(){return makeCtx2D();},
  getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};},focus(){},blur(){},get firstChild(){return this.children[0]||null;},get parentNode(){return null;} };
  el._text='';el._html='';Object.defineProperty(el,'textContent',{get(){return this._text;},set(v){this._text=v;}});
  Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}});
  Object.defineProperty(el,'width',{get(){return 1280;},set(){}});Object.defineProperty(el,'height',{get(){return 720;},set(){}});return el; }
const documentStub={ getElementById(){return makeEl();},createElement(t){return makeEl(t);},createElementNS(){return makeEl();},body:makeEl('body'),addEventListener(){},removeEventListener(){},querySelector(){return makeEl();},documentElement:makeEl('html'),head:makeEl('head') };
function makeAudioNode(){ return new Proxy({},{get(t,p){ if(p==='connect'||p==='start'||p==='stop'||p==='disconnect')return ()=>{}; if(p==='frequency'||p==='gain'||p==='q'||p==='detune')return {value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}}; if(p==='currentTime')return 0; if(p==='destination')return makeAudioNode(); return ()=>makeAudioNode(); }}); }
function AudioContextStub(){ return { currentTime:0,sampleRate:44100,destination:makeAudioNode(),createOscillator(){return makeAudioNode();},createGain(){return makeAudioNode();},createBiquadFilter(){return makeAudioNode();},createAnalyser(){return makeAudioNode();},createBufferSource(){return makeAudioNode();},createBuffer(){return {getChannelData(){return new Float32Array(8);}};},resume(){},suspend(){} }; }

const ctx={}; ctx.globalThis=ctx;ctx.self=ctx;ctx.window=ctx;ctx.console=console;
ctx.Math=Math;ctx.Date=Date;ctx.JSON=JSON;ctx.Object=Object;ctx.Array=Array;ctx.Float32Array=Float32Array;ctx.Uint16Array=Uint16Array;ctx.Uint32Array=Uint32Array;ctx.Int16Array=Int16Array;ctx.ArrayBuffer=ArrayBuffer;ctx.Uint8Array=Uint8Array;ctx.String=String;ctx.Number=Number;ctx.Boolean=Boolean;
ctx.parseInt=parseInt;ctx.parseFloat=parseFloat;ctx.isNaN=isNaN;ctx.isFinite=isFinite;ctx.setTimeout=setTimeout;ctx.clearTimeout=clearTimeout;ctx.setInterval=setInterval;ctx.clearInterval=clearInterval;
ctx.innerWidth=1280;ctx.innerHeight=720;ctx.devicePixelRatio=1;ctx.performance={now:()=>Date.now()};ctx.requestAnimationFrame=()=>0;ctx.cancelAnimationFrame=()=>{};ctx.document=documentStub;
ctx.AudioContext=AudioContextStub;ctx.webkitAudioContext=AudioContextStub;ctx.navigator={userAgent:'node',platform:'node'};ctx.localStorage={_d:{},getItem(k){return this._d[k]??null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
ctx.addEventListener=()=>{};ctx.removeEventListener=()=>{};ctx.atob=(s)=>Buffer.from(s,'base64').toString('binary');ctx.btoa=(s)=>Buffer.from(s,'binary').toString('base64');
vm.createContext(ctx);
const threeSrc=fs.readFileSync('three.min.js','utf8'); vm.runInContext(threeSrc,ctx,{filename:'three.js'});
ctx.THREE.WebGLRenderer=class{constructor(){this.domElement=makeEl('canvas');this.shadowMap={enabled:false};this.info={render:{}};}setPixelRatio(){}setSize(){}render(){}setClearColor(){}setAnimationLoop(){}dispose(){}};
const html=fs.readFileSync('index.html','utf8');
const re=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi; let m,blocks=[];
while((m=re.exec(html))){const c=m[1];if(c.trim().length<50)continue;blocks.push(c);}
vm.runInContext(blocks[2],ctx,{filename:'meshes.js'});
const gameSrc=blocks[3]+'\n;globalThis.__G={Game,Boss,Player,Enemies,Weapons,World,FX,HUD,Synergy,Progress,CFG,Loot,Bullets,Wingmen,Audio2,Mesh,Util,Hazards};';
vm.runInContext(gameSrc,ctx,{filename:'game.js'});
const { Game, Player, Enemies } = ctx.__G;

/* ---------- 启动 + 确定性刷敌 ---------- */
Game.init(); Game.start(false, false);
const b = Enemies.spawn('bomber', Player.x+4, Player.z+4, 1, 1, 1, false, null);
const w = Enemies.spawn('weaver', Player.x-4, Player.z+4, 1, 1, 1, false, null);
const ra = Enemies.spawn('raptor', Player.x+4, Player.z-4, 1, 1, 1, false, null);
const gs = Enemies.spawn('gunship', Player.x-4, Player.z-4, 1, 1, 1, false, null);
Enemies._flush();   // 直接写 InstancedMesh，无需跑整局 director

let ok = true;
for (const [e, key, label] of [[b,'proc_bomber','bomber'],[w,'proc_weaver','weaver'],[ra,'proc_raptor','raptor'],[gs,'proc_gunship','gunship']]){
  const inst = Enemies._insts[key];
  const verts = inst && inst.geometry && inst.geometry.attributes.position
    ? inst.geometry.attributes.position.count : 0;
  const resolved = e.modelKey === key;
  const flushed = inst && inst.count > 0;
  const distinct = verts > 100;   // 默认二十面体(0.7,0) 非索引仅 60 顶点，程序化体应明显更多
  console.log(`${label}: modelKey=${e.modelKey}  inst存在=${!!inst}  顶点数=${verts}  已flush=${flushed}  非默认几何=${distinct}`);
  if (!(resolved && inst && verts > 0 && flushed && distinct)) ok = false;
}
console.log(ok ? '\n✅ PASS：bomber/weaver/raptor/gunship 均使用专属程序化几何，未掉回默认占位' : '\n❌ FAIL');
process.exit(ok ? 0 : 1);
