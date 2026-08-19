/* ============================================================================
 * 星陨幸存者 — 单文件 3D 幸存者类射击
 * 设计目标：自动开火 → 掉经验 → 升级三选一 → 滚雪球变强 → 波次压力 → BOSS
 * 依赖：three.js r160(UMD) + assets/meshes.js(离线烘焙的飞船网格)
 * ==========================================================================*/

/* ============================ CFG 全局配置 ============================ */
const CFG = {
  arena: 78,                 // 战场半径（圆形边界）
  camH: 46, camBack: 30,     // 相机高度 / 后退距离
  camLerp: 0.09,

  player: {
    hp: 100, spd: 21, accel: 12, drag: 7.5, radius: 1.15,
    dashSpd: 52, dashTime: 0.17, dashCd: 1.5, invAfterHit: 0.75,
  },

  waveSec: 60,               // 每波时长
  bossWave: 10,              // 第 10 波结束后 BOSS

  // 经验曲线：每级所需 = base + step*lv^1.32
  xpBase: 5, xpStep: 3.1, xpPow: 1.32,

  pickRadius: 3.4,           // 基础拾取半径
  magnetSpd: 34,

  colors: {
    player:  0x38f0ff,
    striker: 0xffcc33,
    warden:  0x5dff9b,
    howitzer:0xff8a3d,
    charger: 0xff4d6d,
    orbiter: 0xb980ff,
    sniper:  0x4dd2ff,
    splitter:0x8fff5d,
    brute:   0xff7a2f,
    boss:    0xff3d7f,
  },

  // 地狱模式倍率（用户要求：撞击=玩家总血量1/4、敌弹增强、难度曲线更陡）
  hell: {
    collideMul: 0.25,        // 敌人撞击玩家伤害 = 玩家最大生命 × 此值
    enemyWpnMul: 1.7,        // 敌弹伤害倍率
    hpMul: 3.0,              // 难度曲线·血量成长倍率（原 2.2）
    grow: 2.2,               // 刷怪成长倍率 g（原 1.6）
    spdMul: 1.5,             // 敌速倍率（原 1.3）
  },
};

/* ============================ 星域 / 地图（多地图进程） ============================ */
/* 一局分为多个星域（地图）。每域有独立配色 / 敌群风格 / 陨石矿物，过波自动推进。
 * 普通模式固定 5 张地图（波 1-10 → 域 0-4，之后深渊母舰），无尽模式循环轮换，地图永不重样。*/
const STAGES = [
  { name:'残骸星域', sub:'RUBBLE BELT',  accent:'#ff9a4d', bg:0x0c0a08, fog:0x140d07,
    aster:[0x7a6b5a,0x8a5a3a,0x6b5a4a,0x9a6b4a], tint:0xff7a4d,
    pool:['charger','charger','orbiter','kamikaze','splitter','sniper','bomber','raptor'] },
  { name:'寒霜星云', sub:'FROST NEBULA', accent:'#6fe0ff', bg:0x060d14, fog:0x08161f,
    aster:[0x4a6b82,0x5a7a9a,0x3a5a6b,0x6a8a9a], tint:0x5fd0ff,
    pool:['sniper','orbiter','turret','wasp','mender','orbiter','weaver'] },
  { name:'熔火深空', sub:'MOLTEN VOID',  accent:'#ff5a4d', bg:0x140806, fog:0x1c0a05,
    aster:[0x7a4a3a,0x8a3a2a,0x5a2a1a,0x9a4a2a], tint:0xff4d4d,
    pool:['brute','charger','kamikaze','splitter','turret','charger','bomber'] },
  { name:'翡翠虫巢', sub:'EMERALD HIVE', accent:'#6dff8b', bg:0x07120b, fog:0x08180d,
    aster:[0x4a7a55,0x5a8a4a,0x3a6b45,0x6a9a5a], tint:0x6dff8b,
    pool:['wasp','wasp','mender','splitter','orbiter','kamikaze'] },
  { name:'深渊核心', sub:'ABYSSAL CORE', accent:'#b980ff', bg:0x0c0614, fog:0x140820,
    aster:[0x5a4a7a,0x6a3a8a,0x4a3a6b,0x7a4a9a], tint:0xb980ff,
    pool:['phaser','brute','sniper','turret','mender','wasp','orbiter','weaver','gunship','raptor'] },
];

/* ============================ 可选战机 ============================ */
/* 开局可在菜单里挑一架。model 指 meshes.js 里已烘焙的 key（复用现有素材，
 * 不新增 CORS 风险）；color 决定阵营染色 + 光晕/尾焰；hp/spd/fire 是数值倍率。*/
const SHIPS = [
  { id:'falcon',   name:'游隼',   model:'fighter',      color:0x38f0ff, hp:100, spd:21, fire:1.00, talent:null,       startWeapon:'cannon', desc:'均衡标准型 · 机动与火力兼顾',                   trait:'无天赋' },
  { id:'ranger',   name:'游骑兵', model:'wing_a',       color:0x6dff8b, hp:86,  spd:26, fire:1.20, talent:'rate',       startWeapon:'cannon', desc:'高速突进 · 射速更快',                          trait:'射速 +9%' },
  { id:'vanguard', name:'先锋',   model:'enemy_charger', color:0xffd24a, hp:122, spd:18, fire:0.90, talent:'armor',      startWeapon:'cannon', desc:'厚重装甲 · 更耐打',                             trait:'减伤 -6%' },
  { id:'titan',    name:'泰坦',   model:'enemy_brute',  color:0xff6b95, hp:150, spd:15, fire:0.82, talent:'hp',         startWeapon:'cannon', desc:'重装堡垒 · 血厚移动慢',                          trait:'+22 最大生命' },
  { id:'storm',    name:'风暴',   model:'wing_b',       color:0xb980ff, hp:92,  spd:22, fire:1.10, talent:'crit',       startWeapon:'spread', desc:'霰弹专家 · 开局自带散射 · 暴击精准',             trait:'暴击 +7%' },
  { id:'specter',  name:'幽影',   model:'enemy_orbiter', color:0x5dff9b, hp:88,  spd:24, fire:1.05, talent:'speed',      startWeapon:'orbit',  desc:'环绕光刃使者 · 开局自带光刃 · 机动灵活',         trait:'移速 +9%' },
  { id:'hunter',   name:'猎手',   model:'enemy_sniper',  color:0xff5d5d, hp:90,  spd:23, fire:1.15, talent:'crit',       startWeapon:'laser',  desc:'狙击专精 · 开局自带相位激光 · 单点爆发',         trait:'暴击 +7%' },
  { id:'bulwark',  name:'重锤',   model:'hauler',        color:0x6db5ff, hp:142, spd:16, fire:0.86, talent:'armor',      startWeapon:'aura',   desc:'要塞支援 · 开局自带湮灭力场 · 硬抗前线',         trait:'减伤 -6%' },
  { id:'hive',     name:'蜂巢',   model:'enemy_splitter',color:0xc8a2ff, hp:104, spd:21, fire:1.08, talent:'speed',      startWeapon:'drone',  desc:'蜂群指挥 · 开局自带无人僚机 · 以多打少',         trait:'移速 +9%' },
  { id:'arc',      name:'弧光',   model:'enemy_orbiter', color:0x9df6ff, hp:96,  spd:22, fire:1.12, talent:'rate',       startWeapon:'rail',   desc:'电磁炮手 · 开局自带轨道炮 · 远程穿透',           trait:'射速 +9%' },
  { id:'ignis',    name:'炽焰',   model:'enemy_charger',color:0xff7a2f, hp:110, spd:19, fire:1.00, talent:'crit',       startWeapon:'flame',  desc:'烈焰使者 · 开局自带烈焰喷射 · 近身灼烧',         trait:'暴击 +7%' },
];

/* ============================ Util 工具 ============================ */
const Util = {
  TAU: Math.PI * 2,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[(Math.random() * arr.length) | 0],
  clamp: (v, a, b) => v < a ? a : (v > b ? b : v),
  lerp: (a, b, t) => a + (b - a) * t,
  // 角度插值（处理 ±π 环绕）
  angLerp(a, b, t){
    let d = (b - a) % Util.TAU;
    if (d > Math.PI) d -= Util.TAU; else if (d < -Math.PI) d += Util.TAU;
    return a + d * t;
  },
  dist2: (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx*dx + dz*dz; },
  // 洗牌取前 n 个
  sample(arr, n){
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--){
      const j = (Math.random() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.slice(0, n);
  },
  fmtTime(s){
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  },
  // 把点约束在圆形战场内
  clampArena(o, r){
    const d = Math.hypot(o.x, o.z), lim = CFG.arena - (r || 0);
    if (d > lim){ const k = lim / d; o.x *= k; o.z *= k; return true; }
    return false;
  },
};

/* ============================ Mesh 烘焙网格解码 ============================ */
/* assets/meshes.js 里的位置/法线是 Int16 量化 + base64；这里还原成 BufferGeometry。
   这样避开了 file:// 下 GLTFLoader(ESM) 的 CORS 限制，双击就能跑。*/
const Mesh = {
  cache: {},
  _b64(b64){
    const bin = atob(b64), n = bin.length, u8 = new Uint8Array(n);
    for (let i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  },
  _deq(b64, range){
    const u8 = this._b64(b64);
    const q = new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1);
    const f = new Float32Array(q.length);
    const k = range / 32767;
    for (let i = 0; i < q.length; i++) f[i] = q[i] * k;
    return f;
  },
  // 法线是 Int8 量化（1/127 精度足够 Lambert 着色，体积比 Int16 再省一半）
  _deqN(b64){
    const u8 = this._b64(b64);
    const q = new Int8Array(u8.buffer, u8.byteOffset, u8.byteLength);
    const f = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) f[i] = q[i] / 127;
    return f;
  },
  /** 返回 [{geo, color, metal, rough}]，几何缓存复用 */
  parts(key){
    if (this.cache[key]) return this.cache[key];
    const M = (typeof window !== 'undefined' && window.MESHES) ? window.MESHES[key] : null;
    if (!M){ this.cache[key] = null; return null; }
    const out = M.parts.map(p => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this._deq(p.p, M.ps), 3));
      g.setAttribute('normal',   new THREE.BufferAttribute(this._deqN(p.n), 3));
      const iu = this._b64(p.i);
      g.setIndex(new THREE.BufferAttribute(
        p.b ? new Uint32Array(iu.buffer, iu.byteOffset, iu.byteLength >> 2)
            : new Uint16Array(iu.buffer, iu.byteOffset, iu.byteLength >> 1), 1));
      g.computeBoundingSphere();
      return { geo: g, color: p.c, metal: p.m, rough: p.r, emis: p.e };
    });
    this.cache[key] = out;
    return out;
  },
};

/* ============================ Gfx 造型工厂 ============================ */
/* 约定：所有单位 Group 的「机头」朝 +Z，外部只需设置 group.rotation.y = yaw。*/
/* 缺失网格预警集合（每 key 仅 warn 一次，避免刷屏） */
const _missingMeshWarn = {};
const Gfx = {
  // —— 烘焙模型的朝向修正（模型自身坐标系 → 机头 +Z）。
  //    注意：bake_models.mjs 对所有飞船已用 rot:[0,π,0] 在烘焙期把机头旋到 +Z，
  //    所以这里大多数模型应为 0；仅保留旧 Poly Pizza 模型（已弃用）的兼容值。——
  meshYaw: { fighter: 0, hauler: 0 },

  /** 缺失网格时的洋红占位回退：强提示 + 自转方块，便于一眼定位资源故障。
   *  返回与 ship()/enemyShip() 兼容的 {g, mats, meshes}，不引发下游崩溃。*/
  _mkMissingProxy(key){
    if (!_missingMeshWarn[key]){ _missingMeshWarn[key] = 1;
      console.warn('[Gfx] Critical: Missing mesh key: ' + key); }
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xff00ff }));
    box.onBeforeRender = function(){ this.rotation.x += 0.05; this.rotation.y += 0.07; };
    g.add(box);
    return { g, mats: [], meshes: [] };
  },

  _mat(hex, opt){
    const o = opt || {};
    return new THREE.MeshLambertMaterial({
      color: hex,
      emissive: o.emissive != null ? o.emissive : 0x000000,
      emissiveIntensity: o.ei != null ? o.ei : 1,
      transparent: !!o.transparent, opacity: o.opacity != null ? o.opacity : 1,
      side: o.side || THREE.FrontSide,
    });
  },

  /** 用烘焙好的真 3D 飞船建 Group；tint 会与原色相乘，保留模型自身明暗层次。
   *  英雄单位（玩家/僚机）额外加：反向外壳描边 + 翼尖导航灯 + 贴地辉光，提升精致度。*/
  ship(key, tint, scale){
    const parts = Mesh.parts(key);
    const g = new THREE.Group();
    const mats = [];
    if (!parts) return this._mkMissingProxy(key);          // 素材缺失 → 洋红占位 + warn（不再静默空壳）
    const t = new THREE.Color(tint == null ? 0xffffff : tint);
    for (const p of parts){
      const base = new THREE.Color(p.color[0], p.color[1], p.color[2]);
      // 混合：保留 45% 原色（金属灰/黑），叠加 55% 阵营色，避免整船糊成一片
      const lum = 0.299*base.r + 0.587*base.g + 0.114*base.b;
      const c = new THREE.Color(
        base.r * 0.45 + t.r * (0.35 + lum * 0.5),
        base.g * 0.45 + t.g * (0.35 + lum * 0.5),
        base.b * 0.45 + t.b * (0.35 + lum * 0.5));
      const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.18 });
      const mesh = new THREE.Mesh(p.geo, m);
      mesh.castShadow = false; mesh.receiveShadow = false;
      g.add(mesh); mats.push(m);
      // —— 反向外壳描边：BackSide + 放大 1.05，让轮廓更利落（cel 风） ——
      const ol = new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({
        color: 0x05070f, side: THREE.BackSide }));
      ol.scale.multiplyScalar(1.05);
      g.add(ol);
    }
    const yf = this.meshYaw[key] || 0;
    if (yf) g.children.forEach(c => { c.rotation.y = yf; });
    // 翼尖导航灯（阵营色发光小球，细节感）
    const lc = new THREE.Color(Math.min(1, t.r * 1.3 + 0.12),
                                Math.min(1, t.g * 1.3 + 0.12),
                                Math.min(1, t.b * 1.3 + 0.12));
    for (const sx of [-0.85, 0.85]){
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5),
        new THREE.MeshBasicMaterial({ color: lc, transparent: true, opacity: 0.92,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      light.position.set(sx, 0.18, 0.45);
      g.add(light);
    }
    // 座舱罩：流线型玻璃罩（cel 描边 + 顶部高光），贴合机头而非凸出发光泡（VS 友好造型）
    const canopyGeo = new THREE.SphereGeometry(0.4, 16, 10, 0, Util.TAU, 0, Math.PI * 0.5);
    const canopyMat = new THREE.MeshLambertMaterial({ color: lc, transparent: true, opacity: 0.46,
      emissive: new THREE.Color(lc.r * 0.22, lc.g * 0.22, lc.b * 0.22), emissiveIntensity: 0.6,
      depthWrite: false, side: THREE.DoubleSide });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.52, 0.22);
    canopy.scale.set(1.0, 0.8, 1.55);
    g.add(canopy);
    // cel 描边外壳（与机身轮廓一致的利落边）
    const canopyOl = new THREE.Mesh(canopyGeo, new THREE.MeshBasicMaterial({ color: 0x05070f, side: THREE.BackSide }));
    canopyOl.position.copy(canopy.position);
    canopyOl.scale.set(1.06, 0.848, 1.643);
    g.add(canopyOl);
    // 顶部玻璃高光（一道亮条，制造反光观感）
    const canopyHi = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 6, 0, Util.TAU, 0, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    canopyHi.position.set(0, 0.6, 0.08);
    canopyHi.scale.set(0.7, 0.45, 1.3);
    g.add(canopyHi);
    // 贴地阵营辉光（把飞船"钉"在战场上，也增加色彩层次）
    g.add(this.glow(t.getHex(), 1.5, 0.16));
    if (scale && scale !== 1) g.scale.setScalar(scale);
    return { g, mats };
  },

  /** 敌人用的真 3D 飞船：返回 Group + 材质数组。
   *  用法：const r = Gfx.enemyShip(key, tint, scale); key 为 meshes.js 里的完整模型名
   *        （如 'enemy_charger' / 'wing_a'），r.g 是 Object3D；r.mats 用于变色。*/
  _enemyShipCache: {},
  enemyShip(key, tint, scale){
    const parts = Mesh.parts(key);
    if (!parts) return this._mkMissingProxy(key);          // 素材缺失 → 洋红占位 + warn
    // 复用一个 geometry，但每实例独立 material（用于变色/受伤闪白/精英高亮）
    const t = new THREE.Color(tint == null ? 0xffffff : tint);
    const meshes = [];
    const mats = [];
    for (const p of parts){
      const base = new THREE.Color(p.color[0], p.color[1], p.color[2]);
      const lum = 0.299*base.r + 0.587*base.g + 0.114*base.b;
      const c = new THREE.Color(
        base.r * 0.4 + t.r * (0.4 + lum * 0.6),
        base.g * 0.4 + t.g * (0.4 + lum * 0.6),
        base.b * 0.4 + t.b * (0.4 + lum * 0.6));
      const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.22 });
      const mesh = new THREE.Mesh(p.geo, m);
      mesh.scale.setScalar(scale || 1);
      meshes.push(mesh); mats.push(m);
      // 反向外壳描边：与英雄单位一致的 cel 风轮廓（BackSide + 放大 1.06），
      // 让敌群在混战里轮廓更利落可辨；材质不入 mats，不影响受伤闪白/变色。
      const ol = new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({
        color: 0x05070f, side: THREE.BackSide }));
      ol.scale.setScalar((scale || 1) * 1.06);
      meshes.push(ol);
    }
    const g = new THREE.Group(); meshes.forEach(m => g.add(m));
    // 尾部引擎辉光（朝 -Z，与机头 +Z 相反 → 背对玩家，符合飞行姿态，增加生命感）
    g.add(this.thruster(t.getHex(), 0.16, -0.6));
    return { g, mats, meshes };
  },

  /** 敌人 InstancedMesh 用：把烘焙真 3D 模型的全部 body 部件合并成单个几何
   *  （去掉反向描边壳 / 尾焰），保留 position+normal 供受光着色 + instanceColor 染色。
   *  每种 variant 模型只建一次并缓存；缺失时返回 null，调用方回退到默认几何。*/
  _enemyBodyCache: {},
  /** 程序化敌人几何注册表：key → 返回 [{geo}]（与烘焙模型同一套 {geo} 形态）。
   *  用于给"换皮"兵种（bomber/weaver）补独立轮廓，零新素材、纯 three 基元拼装。*/
  _procEnemy: {
    /** bomber 轰炸者：圆滚炸弹体 + 4 武装尖刺 + 顶部引信锥 + 赤道环（自爆胖子辨识度） */
    proc_bomber(){
      const out = [];
      const push = (geo) => out.push({ geo: geo.index ? geo.toNonIndexed() : geo });
      push(new THREE.IcosahedronGeometry(0.62, 1));                       // 主体炸弹（低面数契合游戏画风）
      const top = new THREE.ConeGeometry(0.18, 0.34, 7); top.translate(0, 0.68, 0); push(top); // 引信锥
      for (let i = 0; i < 4; i++){                                        // 4 根赤道武装尖刺
        const a = i / 4 * Util.TAU;
        const c = new THREE.ConeGeometry(0.13, 0.42, 6);
        c.rotateZ(-Math.PI / 2); c.rotateY(a);                            // 尖端朝外
        c.translate(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6); push(c);
      }
      const ring = new THREE.TorusGeometry(0.66, 0.07, 6, 16); ring.rotateX(Math.PI / 2); push(ring); // 赤道环
      return out;
    },
    /** weaver 编织者：拉长菱形机身 + 前置机鼻 + 两侧后掠翼 + 尾鳍（灵巧游击机辨识度） */
    proc_weaver(){
      const out = [];
      const push = (geo) => out.push({ geo: geo.index ? geo.toNonIndexed() : geo });
      const body = new THREE.OctahedronGeometry(0.55, 0); body.scale(0.55, 0.5, 1.15); push(body); // 机身
      const nose = new THREE.ConeGeometry(0.16, 0.5, 6); nose.rotateX(Math.PI / 2); nose.translate(0, 0, 0.98); push(nose); // 机鼻
      for (const s of [-1, 1]){                                            // 两侧后掠翼
        const w = new THREE.BoxGeometry(0.62, 0.08, 0.34);
        w.rotateY(s * 0.5); w.translate(s * 0.5, 0, -0.1); push(w);
      }
      const tf = new THREE.BoxGeometry(0.07, 0.34, 0.3); tf.translate(0, 0.18, -0.62); push(tf);     // 尾鳍
      return out;
    },
    /** raptor 猛禽截击机：纤细箭形机身 + 机鼻 + 后掠三角翼 + 双垂尾（敏捷战机辨识度） */
    proc_raptor(){
      const out = [];
      const push = (geo) => out.push({ geo: geo.index ? geo.toNonIndexed() : geo });
      const body = new THREE.OctahedronGeometry(0.52, 0); body.scale(0.42, 0.4, 1.35); push(body); // 箭形机身
      const nose = new THREE.ConeGeometry(0.15, 0.55, 6); nose.rotateX(Math.PI / 2); nose.translate(0, 0, 1.02); push(nose); // 机鼻
      for (const s of [-1, 1]){                                            // 后掠三角翼
        const w = new THREE.BoxGeometry(0.7, 0.07, 0.36);
        w.rotateY(s * 0.6); w.translate(s * 0.5, 0, -0.18); push(w);
      }
      for (const s of [-1, 1]){                                            // 双垂尾
        const t = new THREE.BoxGeometry(0.07, 0.32, 0.26);
        t.translate(s * 0.16, 0.16, -0.6); push(t);
      }
      return out;
    },
    /** gunship 炮舰战机：宽厚机身 + 大展弦翼 + 背部炮塔 + 尾部引擎块（重型战机辨识度） */
    proc_gunship(){
      const out = [];
      const push = (geo) => out.push({ geo: geo.index ? geo.toNonIndexed() : geo });
      const body = new THREE.BoxGeometry(0.5, 0.46, 1.1); push(body);      // 宽厚机身
      const nose = new THREE.ConeGeometry(0.22, 0.4, 6); nose.rotateX(Math.PI / 2); nose.translate(0, 0, 0.78); push(nose); // 机鼻
      for (const s of [-1, 1]){                                            // 大展弦翼
        const w = new THREE.BoxGeometry(0.95, 0.1, 0.42);
        w.rotateY(s * 0.32); w.translate(s * 0.72, -0.02, -0.05); push(w);
      }
      const turret = new THREE.CylinderGeometry(0.16, 0.2, 0.28, 7); turret.translate(0, 0.32, 0.05); push(turret); // 背部炮塔
      const eng = new THREE.BoxGeometry(0.42, 0.38, 0.3); eng.translate(0, 0, -0.62); push(eng); // 尾部引擎
      return out;
    },
  },
  enemyBodyGeo(vk){
    if (this._enemyBodyCache[vk] !== undefined) return this._enemyBodyCache[vk];
    let parts = Mesh.parts(vk);
    if ((!parts || !parts.length) && this._procEnemy[vk]) parts = this._procEnemy[vk]();   // 程序化几何兜底
    if (!parts || !parts.length){ this._enemyBodyCache[vk] = null; return null; }
    // 烘焙模型是「索引几何」：必须先 toNonIndexed 展开顶点，否则直接拼接顶点数组会因
    // 索引引用错位导致表面缺失/撕裂（即"建模显示不完全"的根因）。
    const pos = [], nrm = [];
    for (const p of parts){
      const ng = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      const P = ng.attributes.position, N = ng.attributes.normal;
      for (let i = 0; i < P.array.length; i++) pos.push(P.array[i]);
      for (let i = 0; i < N.array.length; i++) nrm.push(N.array[i]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(nrm), 3));
    g.computeBoundingSphere();
    this._enemyBodyCache[vk] = g;
    return g;
  },

  /** 无人僚机：真 3D 侦察无人机（着色 + 反向描边 + 旋翼导航灯 + 微推进器） */
  drone(tint, scale){
    const parts = Mesh.parts('drone');
    const g = new THREE.Group();
    const t = new THREE.Color(tint == null ? 0xffcc33 : tint);
    if (parts) for (const p of parts){
      const base = new THREE.Color(p.color[0], p.color[1], p.color[2]);
      const lum = 0.299*base.r + 0.587*base.g + 0.114*base.b;
      const c = new THREE.Color(
        base.r*0.5  + t.r*(0.3 + lum*0.5),
        base.g*0.5  + t.g*(0.3 + lum*0.5),
        base.b*0.5  + t.b*(0.3 + lum*0.5));
      const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.2 });
      g.add(new THREE.Mesh(p.geo, m));
      const ol = new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({ color: 0x05070f, side: THREE.BackSide }));
      ol.scale.multiplyScalar(1.06); g.add(ol);
    }
    // 四旋翼导航灯（阵营色发光小球，细节感）
    const lc = new THREE.Color(Math.min(1, t.r*1.3+0.12), Math.min(1, t.g*1.3+0.12), Math.min(1, t.b*1.3+0.12));
    for (const [px,pz] of [[0.248,0.248],[-0.248,0.248],[0.248,-0.248],[-0.248,-0.248]]){
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5),
        new THREE.MeshBasicMaterial({ color: lc, transparent: true, opacity: 0.92,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      light.position.set(px, 0.03, pz); g.add(light);
    }
    // 旋翼桨叶（高速旋转的可见叶片，增强"无人机在飞"的生动感）
    const rotors = new THREE.Group();
    const bladeGeo = new THREE.BoxGeometry(0.26, 0.02, 0.05);
    const bladeMat = new THREE.MeshBasicMaterial({ color: lc.getHex(), transparent: true,
      opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const [px,pz] of [[0.248,0.248],[-0.248,0.248],[0.248,-0.248],[-0.248,-0.248]]){
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(px, 0.03, pz);
      rotors.add(blade);
    }
    g.add(rotors);
    g.userData.rotors = rotors;
    // 朝 -Z 的微推进器（飞行姿态 + 生命感）
    g.add(this.thruster(t.getHex(), 0.10, -0.30, { opacity: 0.5, core: 0.6 }));
    if (scale && scale !== 1) g.scale.setScalar(scale);
    return g;
  },

  /** 医疗机：救援舱 + 发光绿十字（辨识度即"这是医疗机"），不再复用运输机 */
  medic(tint, scale){
    const g = new THREE.Group();
    const t = new THREE.Color(tint == null ? 0x6dff8b : tint);
    // 圆润救援舱机体（白绿医疗配色）
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12),
      new THREE.MeshLambertMaterial({ color: 0xeaf6ee, emissive: 0x16361f, emissiveIntensity: 0.3 }));
    hull.scale.set(1.0, 0.82, 1.28);
    g.add(hull);
    const ol = new THREE.Mesh(hull.geometry, new THREE.MeshBasicMaterial({ color: 0x05070f, side: THREE.BackSide }));
    ol.scale.copy(hull.scale).multiplyScalar(1.06); g.add(ol);
    // 侧翼（阵营绿）
    const wingMat = new THREE.MeshLambertMaterial({ color: t.getHex(), emissive: t.getHex(), emissiveIntensity: 0.22 });
    for (const sx of [-1, 1]){
      const wf = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.32), wingMat);
      wf.position.set(sx * 0.56, -0.02, -0.12); wf.rotation.z = sx * 0.38; g.add(wf);
    }
    // 医疗十字（加法发光绿，顶面 + 前面各一个，顶视/侧视都认得出）
    const crossMat = new THREE.MeshBasicMaterial({ color: t.getHex(), transparent: true, opacity: 0.96,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    // 顶面十字（臂沿 X / Z）
    const topV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.5), crossMat);
    const topH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.12), crossMat);
    topV.position.set(0, 0.44, 0.05); topH.position.set(0, 0.44, 0.05); g.add(topV, topH);
    // 前面十字（臂沿 X / Y，朝机头 +Z）
    const fV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.12), crossMat);
    const fH = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.12), crossMat);
    fV.position.set(0, 0.06, 0.52); fH.position.set(0, 0.06, 0.52); g.add(fV, fH);
    // 座舱罩
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Util.TAU, 0, Math.PI * 0.55),
      new THREE.MeshBasicMaterial({ color: t.getHex(), transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    canopy.position.set(0, 0.36, 0.18); canopy.scale.set(1, 0.85, 1.25); g.add(canopy);
    // 导航灯
    const lc = new THREE.Color(Math.min(1, t.r*1.3+0.12), Math.min(1, t.g*1.3+0.12), Math.min(1, t.b*1.3+0.12));
    for (const sx of [-0.5, 0.5]){
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5),
        new THREE.MeshBasicMaterial({ color: lc, transparent: true, opacity: 0.92,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      light.position.set(sx, 0.2, -0.5); g.add(light);
    }
    if (scale && scale !== 1) g.scale.setScalar(scale);
    return { g };
  },

  /** 环绕光刃：真 3D 双刃模型 + 加法青色辉光（保留能量武器观感） */
  blade(tint){
    const parts = Mesh.parts('blade');
    const col = tint == null ? 0x8ff0ff : tint;
    if (!parts) return new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.3, 4),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    return new THREE.Mesh(parts[0].geo, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  },

  /** BOSS：多层旋转要塞 */
  thruster(color, size, z, opt){
    const g = new THREE.Group();
    const o = opt || {};
    const opC = o.opacity != null ? o.opacity : 0.72;
    const opK = o.core != null ? o.core : 0.9;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(size * 0.5, size * 2.1, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opC,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.rotation.x = Math.PI / 2;          // 尖端指向 -Z
    cone.position.z = -size * 1.05;
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.42, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: opK,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(cone, core);
    g.position.z = z;
    g.userData.cone = cone; g.userData.core = core;
    return g;
  },

  /** 地面光晕（贴地圆片，用来把单位"钉"在地面上，2.5D 关键） */
  glow(color, r, op){
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(r, 20),
      new THREE.MeshBasicMaterial({ color: color, transparent: true,
        opacity: op == null ? 0.26 : op, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.04;
    return m;
  },

  /* ---- 敌人：每种造型合并成单个 geometry，1 敌人 = 1 drawcall ---- */
  _enemyGeoCache: {},
  enemyGeo(kind){
    if (this._enemyGeoCache[kind]) return this._enemyGeoCache[kind];
    const src = [];        // {geo, mat4, shade} shade 用于顶点色明暗
    const add = (geo, x, y, z, rx, ry, rz, sh) => {
      const m = new THREE.Matrix4();
      m.compose(new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)),
        new THREE.Vector3(1, 1, 1));
      src.push({ geo, m, sh: sh == null ? 1 : sh });
    };

    if (kind === 'charger'){                       // 冲锋兵：楔形箭头
      add(new THREE.ConeGeometry(0.62, 1.9, 4), 0, 0, 0.25, Math.PI/2, 0, Math.PI/4, 1.0);
      add(new THREE.BoxGeometry(1.5, 0.24, 0.5),  0, 0, -0.4, 0, 0, 0, 0.55);
      add(new THREE.BoxGeometry(0.3, 0.3, 0.5),   0, 0.16, -0.55, 0, 0, 0, 1.5);
    } else if (kind === 'orbiter'){                // 环绕者：八面体 + 环
      add(new THREE.OctahedronGeometry(0.72, 0), 0, 0.1, 0, 0, 0, 0, 1.0);
      add(new THREE.TorusGeometry(0.95, 0.09, 6, 14), 0, 0.1, 0, Math.PI/2, 0, 0, 0.65);
      add(new THREE.SphereGeometry(0.3, 8, 6), 0, 0.1, 0.5, 0, 0, 0, 1.7);
    } else if (kind === 'sniper'){                 // 狙击者：细长炮台
      add(new THREE.CylinderGeometry(0.1, 0.12, 2.0, 7), 0, 0.12, 0.55, Math.PI/2, 0, 0, 1.5);
      add(new THREE.BoxGeometry(0.95, 0.42, 0.95), 0, 0.05, -0.35, 0, Math.PI/4, 0, 0.75);
      add(new THREE.BoxGeometry(0.28, 0.7, 0.28), -0.62, 0, -0.4, 0, 0, 0.3, 0.5);
      add(new THREE.BoxGeometry(0.28, 0.7, 0.28),  0.62, 0, -0.4, 0, 0, -0.3, 0.5);
    } else if (kind === 'splitter'){               // 分裂者：一堆小球
      add(new THREE.IcosahedronGeometry(0.62, 0), 0, 0.1, 0, 0, 0, 0, 1.0);
      add(new THREE.IcosahedronGeometry(0.3, 0), 0.55, 0.16, 0.28, 0, 0, 0, 1.3);
      add(new THREE.IcosahedronGeometry(0.3, 0), -0.5, 0.16, -0.3, 0, 0, 0, 1.3);
      add(new THREE.IcosahedronGeometry(0.26, 0), 0.1, 0.3, -0.6, 0, 0, 0, 1.3);
    } else if (kind === 'brute'){                  // 重甲：厚重方块
      add(new THREE.BoxGeometry(1.5, 0.85, 1.9), 0, 0.2, 0, 0, 0, 0, 0.85);
      add(new THREE.BoxGeometry(1.95, 0.4, 0.85), 0, 0.2, -0.15, 0, 0, 0, 0.6);
      add(new THREE.ConeGeometry(0.5, 0.9, 4), 0, 0.2, 1.15, Math.PI/2, 0, Math.PI/4, 1.35);
      add(new THREE.BoxGeometry(0.34, 0.34, 0.4), -0.5, 0.2, -1.0, 0, 0, 0, 1.7);
      add(new THREE.BoxGeometry(0.34, 0.34, 0.4),  0.5, 0.2, -1.0, 0, 0, 0, 1.7);
    } else {                                        // 兜底
      add(new THREE.IcosahedronGeometry(0.7, 0), 0, 0.1, 0, 0, 0, 0, 1);
    }

    // —— 手动合并（不依赖 BufferGeometryUtils）——
    // 部件明暗写进顶点色，配合 material.vertexColors 直接相乘，
    // 于是「一个敌人 = 一次 drawcall」，同时还保留部件层次感。
    let vTot = 0, iTot = 0;
    for (const s of src){
      vTot += s.geo.attributes.position.count;
      iTot += s.geo.index ? s.geo.index.count : s.geo.attributes.position.count;
    }
    const pos = new Float32Array(vTot * 3), nrm = new Float32Array(vTot * 3);
    const col = new Float32Array(vTot * 3);
    const idx = new Uint16Array(iTot);
    let vo = 0, io = 0;
    const nm3 = new THREE.Matrix3();
    const v3 = new THREE.Vector3();
    for (const s of src){
      const P = s.geo.attributes.position, N = s.geo.attributes.normal;
      nm3.getNormalMatrix(s.m);
      for (let i = 0; i < P.count; i++){
        v3.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(s.m);
        pos[(vo+i)*3] = v3.x; pos[(vo+i)*3+1] = v3.y; pos[(vo+i)*3+2] = v3.z;
        v3.set(N.getX(i), N.getY(i), N.getZ(i)).applyMatrix3(nm3).normalize();
        nrm[(vo+i)*3] = v3.x; nrm[(vo+i)*3+1] = v3.y; nrm[(vo+i)*3+2] = v3.z;
        col[(vo+i)*3] = s.sh; col[(vo+i)*3+1] = s.sh; col[(vo+i)*3+2] = s.sh;
      }
      if (s.geo.index){ const I = s.geo.index;
        for (let i = 0; i < I.count; i++) idx[io+i] = vo + I.getX(i);
        io += I.count;
      } else {
        for (let i = 0; i < P.count; i++) idx[io+i] = vo + i;
        io += P.count;
      }
      vo += P.count;
      s.geo.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal',   new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    this._enemyGeoCache[kind] = g;
    return g;
  },

  /** 敌人材质：靠顶点色做部件明暗，单材质出层次，零自定义 shader */
  enemyMat(color){
    return new THREE.MeshLambertMaterial({
      color: color, emissive: color, emissiveIntensity: 0.18, vertexColors: true });
  },

  /** 敌人：占位合并几何（保留旧 enemyGeo API，便于过渡或回退） */
  enemyGeo(kind){
    return this._enemyShipCache['enemy_' + kind] ? this._enemyShipCache['enemy_' + kind][0].geo : null;
  },
  enemyMat(color){
    return new THREE.MeshLambertMaterial({ color: color, emissive: color, emissiveIntensity: 0.22 });
  },
  boss(){
    const g = new THREE.Group();
    const C = CFG.colors.boss;
    // —— 外层船体：cargoA 环带（最大结构体） ——
    const hullParts = Mesh.parts('boss_spine');
    const hull = new THREE.Group();
    for (const p of hullParts){
      const c = new THREE.Color(p.color[0], p.color[1], p.color[2]);
      const m = new THREE.MeshLambertMaterial({ color: 0x1a0810, emissive: C, emissiveIntensity: 0.28 });
      const mesh = new THREE.Mesh(p.geo, m);
      hull.add(mesh);
    }
    hull.scale.setScalar(0.55);
    hull.rotation.x = 0;
    hull.position.y = 0;
    g.add(hull);

    // —— 核心：turret_single（Kenney 炮台站姿） ——
    const coreParts = Mesh.parts('boss_core');
    const core = new THREE.Group();
    for (const p of coreParts){
      const c = new THREE.Color(p.color[0], p.color[1], p.color[2]);
      const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 });
      const mesh = new THREE.Mesh(p.geo, m);
      core.add(mesh);
    }
    core.scale.setScalar(0.42);
    core.position.y = 0.6;
    g.add(core);

    // —— 4 层能量环（X 倾斜叠加，沿 Y 旋转） ——
    const rings = [];
    for (let i = 0; i < 4; i++){
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(2.6 + i * 0.8, 0.12 + i * 0.04, 6, 32),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffcc33 : C,
          transparent: true, opacity: 0.66 - i * 0.09, depthWrite: false }));
      r.rotation.x = Math.PI / 2 + (i - 1.5) * 0.22;
      r.rotation.z = i * 0.5;
      g.add(r); rings.push(r);
    }

    // —— 6 座真模型炮塔（turret_double 沿圆周排布） ——
    const turrets = [];
    const armParts = Mesh.parts('boss_arm');
    for (let i = 0; i < 6; i++){
      const a = i / 6 * Util.TAU;
      const arm = new THREE.Group();
      for (const p of armParts){
        const c = new THREE.Color(p.color[0], p.color[1], p.color[2]);
        const m = new THREE.MeshLambertMaterial({ color: c, emissive: 0xffaa44, emissiveIntensity: 0.4 });
        const mesh = new THREE.Mesh(p.geo, m);
        arm.add(mesh);
      }
      arm.scale.setScalar(0.26);
      arm.position.set(Math.cos(a) * 3.2, 0.4, Math.sin(a) * 3.2);
      arm.rotation.y = -a;
      g.add(arm); turrets.push(arm);
    }

    const halo = this.glow(C, 5, 0.28); g.add(halo);

    // 外层能量光环（更大更亮，缓慢呼吸，强化威压感）
    const outerHalo = new THREE.Mesh(
      new THREE.TorusGeometry(6.4, 0.18, 8, 64),
      new THREE.MeshBasicMaterial({ color: C, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    outerHalo.rotation.x = Math.PI / 2;
    g.add(outerHalo);

    // 3 颗环绕卫星舱（沿大圆公转，增加体量感与机械细节）
    const pods = [];
    const podGeo = new THREE.IcosahedronGeometry(0.5, 0);
    for (let i = 0; i < 3; i++){
      const pod = new THREE.Mesh(podGeo, new THREE.MeshLambertMaterial({
        color: 0x2a0d18, emissive: 0xffcc33, emissiveIntensity: 0.7 }));
      pod.scale.setScalar(0.9);
      g.add(pod); pods.push(pod);
    }

    g.userData = { hull, core, rings, turrets, halo, outerHalo, pods };
    return g;
  },
};

/* ============================ Pool 对象池 ============================ */
/* swap-remove：release 时把末尾元素换到空位，保证 active 数组紧凑无空洞。*/
const Pool = {
  create(cap, factory){
    const p = {
      cap, items: [], active: [], free: [], count: 0, factory,
      _grow(){
        const o = this.factory();
        o._pi = this.items.length;
        this.items.push(o);
        return o;
      },
      get(){
        let o;
        if (this.free.length) o = this.free.pop();
        else if (this.items.length < this.cap) o = this._grow();
        else return null;                       // 满了就丢弃新请求，保帧率
        o._ai = this.active.length;
        this.active.push(o);
        this.count = this.active.length;
        o.alive = true;      // 业务语义：还活着（业务层可提前置 false 表示"正在死"）
        o._in   = true;      // 池语义：当前在 active 列表里（只由池自己维护）
        return o;
      },
      release(o){
        if (!o._in) return;  // 只认池自己的标记，避免业务层提前置 alive=false 导致回收失败
        o._in = false;
        o.alive = false;
        const i = o._ai, last = this.active.pop();
        if (last !== o){ this.active[i] = last; last._ai = i; }
        this.count = this.active.length;
        this.free.push(o);
      },
      releaseAll(){
        while (this.active.length) this.release(this.active[this.active.length - 1]);
      },
      /** 倒序遍历，回调返回 true 表示回收 */
      each(fn){
        for (let i = this.active.length - 1; i >= 0; i--){
          const o = this.active[i];
          if (fn(o) === true) this.release(o);
        }
      },
    };
    return p;
  },
};

/* ============================ Grid 空间哈希 ============================ */
/* 敌人上百时，O(n²) 碰撞会炸；用格子把查询降到邻域。*/
const Grid = {
  cell: 5,
  OFF: 512,          // 坐标偏移，保证格子索引非负（|0 对负数是向零取整，会把 -0.5 和 0.5 归一格）
  map: new Map(),
  clear(){ this.map.clear(); },
  _k(cx, cz){ return (cx + this.OFF) * 1024 + (cz + this.OFF); },
  insert(o){
    const k = this._k(Math.floor(o.x / this.cell), Math.floor(o.z / this.cell));
    let b = this.map.get(k);
    if (!b){ b = []; this.map.set(k, b); }
    b.push(o);
  },
  /** 收集半径 r 内的候选（返回复用数组，勿长期持有） */
  _out: [],
  query(x, z, r){
    const out = this._out; out.length = 0;
    const c = this.cell, n = Math.ceil(r / c);
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++){
      const b = this.map.get(this._k(cx + i, cz + j));
      if (b) for (let k = 0; k < b.length; k++) out.push(b[k]);
    }
    return out;
  },
};
