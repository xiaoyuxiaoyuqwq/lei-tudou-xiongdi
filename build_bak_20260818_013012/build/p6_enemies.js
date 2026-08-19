
/* ============================ Enemies 敌人 ============================ */
// 三大舰队（涂装/归属）：用于敌人配色微调，让同舰队兵种带可辨识的阵营色，但不覆盖兵种本色
const EFAC = { charger:'scrap', kamikaze:'scrap', splitter:'scrap', brute:'scrap', bomber:'scrap',
               wasp:'void', mender:'void', orbiter:'void', weaver:'void', raptor:'void',
               sniper:'abyss', turret:'abyss', phaser:'abyss', gunship:'abyss' };
const FAC = { scrap:0xff7a4d, void:0xb060ff, abyss:0x4dffa0 };
const Enemies = {
  pool: null, group: null, spawnCd: 0,
  _curTint: null,   // 当前星域的统一敌群配色（分裂子代 / BOSS 召唤复用）
  blastQ: [],   // 重甲死亡爆炸队列，成对存 [x,z]，在 update 里迭代结算

  /* 种类基准值（会被波次系数放大）
     三支外星舰队（仅世界观/布阵归属，机制不变）：
       残骸掠夺者  : charger kamikaze splitter brute
       虚空母巢    : wasp(蜂群机) mender(修理舰)
       深渊军团    : sniper turret phaser(相位折跃者)
     （注：方案中的 spread/buffer/stalker 等新敌种将在后续阶段并入，key 不与武器冲突） */
  SPEC: {
    charger:  { hp:22,  spd:9.5,  r:0.95, dmg:9,  xp:1, color:CFG.colors.charger,  ai:'chase', variants:['enemy_charger','enemy_sniper','wing_a'] },
    orbiter:  { hp:34,  spd:8.2,  r:1.05, dmg:7,  xp:2, color:CFG.colors.orbiter,  ai:'orbit', variants:['enemy_orbiter','wing_b'] },
    sniper:   { hp:26,  spd:6.4,  r:1.00, dmg:12, xp:3, color:CFG.colors.sniper,   ai:'snipe', variants:['enemy_sniper','enemy_charger'] },
    splitter: { hp:40,  spd:7.4,  r:1.10, dmg:8,  xp:3, color:CFG.colors.splitter, ai:'chase', variants:['enemy_splitter','enemy_orbiter'] },
    brute:    { hp:150, spd:5.0,  r:1.75, dmg:20, xp:8, color:CFG.colors.brute,    ai:'chase', variants:['enemy_brute','enemy_charger'] },
    kamikaze: { hp:16,  spd:16,   r:0.8,  dmg:16, xp:2, color:0xff5a3c,            ai:'rush',   variants:['enemy_charger','enemy_sniper'] },
    turret:   { hp:60,  spd:0,    r:1.10, dmg:10, xp:3, color:0xffa02e,            ai:'turret', variants:['enemy_sniper','enemy_orbiter'] },
    wasp:     { hp:14,  spd:13,   r:0.7,  dmg:7,  xp:1, color:0xff8a3c,            ai:'chase', variants:['wasp'] },
    mender:   { hp:50,  spd:7,    r:1.0,  dmg:6,  xp:5, color:0x6dff8b,            ai:'support', variants:['mender'] },
    phaser:   { hp:30,  spd:7.5,  r:0.9,  dmg:11, xp:3, color:0xc77dff,            ai:'blink', variants:['phaser'] },
    bomber:   { hp:28,  spd:7.5,  r:0.95, dmg:14, xp:3, color:0xff4422,            ai:'bomber', variants:['proc_bomber'] },
    weaver:   { hp:30,  spd:9.5,  r:0.9,  dmg:9,  xp:3, color:0x9d6bff,            ai:'weave',  variants:['proc_weaver'] },
    // 新增战机（程序化建模，复用现有 AI 行为分支，免新机制）：
    raptor:   { hp:24,  spd:11.5, r:0.92, dmg:10, xp:3, color:0x4dd2ff,            ai:'weave',  variants:['proc_raptor'], fac:'void' },
    gunship:  { hp:70,  spd:5.5,  r:1.15, dmg:13, xp:4, color:0xffa02e,            ai:'orbit',  variants:['proc_gunship'], fac:'abyss' },
    // 小Boss·战帅：独立区域首领（非 BOSS 单例），高血量大体型，环形弹幕 + 蓄力突进，复用敌人机制免新模型
    warlord:  { hp:820, spd:6.6,  r:2.6,  dmg:26, xp:45, color:0xff2d6d,           ai:'warlord', variants:['enemy_brute','enemy_charger'], fac:'abyss' },
  },

  /* 变异：按波次概率触发，变异直接染敌体发光（不再用地面光环，避免遮挡辨识度）
     重甲/疾速/再生/狂暴/腐蚀/裂变 —— 让 24 把武器在更长局内遇到更多样威胁 */
  MUT: {
    armored: { name:'重甲', color:0x9fb4c8, hp:1.6,  spd:0.85 },
    swift:   { name:'疾速', color:0x4dd2ff, hp:0.9,  spd:1.45 },
    regen:   { name:'再生', color:0x6dff8b, hp:1.15 },
    berserk: { name:'狂暴', color:0xff4d4d, hp:1.1  },
    toxic:   { name:'腐蚀', color:0x8dff5a, hp:1.1  },
    split:   { name:'裂变', color:0xffa02e, hp:1.0  },
  },
  MUT_KEYS: ['armored','swift','regen','berserk','toxic','split'],

  _rollMut(allow, elite){
    if (!allow) return '';
    const w = (typeof Game !== 'undefined' && Game.wave) ? Game.wave : 1;
    if (w < 4) return '';
    if (elite) return Util.pick(this.MUT_KEYS);
    const chance = Util.clamp((w - 4) * 0.03 * (Game.hell ? 2.4 : 1), 0, 0.85);
    return Math.random() < chance ? Util.pick(this.MUT_KEYS) : '';
  },

  init(){
    this.group = new THREE.Group();          // 保留容器，便于整体管理（实例本体直挂 scene）
    World.scene.add(this.group);
    this._pid = 0;
    this.pool = Pool.create(300, () => ({
      x:0, z:0, vx:0, vz:0, yaw:0,
      hp:0, maxHp:0, r:1, spd:0, dmg:0, xp:1, ai:'chase',
      t:0, fireCd:0, phase:0, hitT:0, slowT:0, slowK:0, elite:false, scale:1,
      blinkCd:0, healCd:0,
      kind:null, modelKey:null, color:0xffffff,
      alive:false, _pi:0, _ai:0,
      mut:'', mutT:0, raging:false, spdMul:1, dmgMul:1,
    }));
    // —— 每 variant 模型一个 InstancedMesh：1 变体 = 1 draw call（原多部件 Group 至多 ~4 draw call）——
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion();
    this._e = new THREE.Euler(); this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
    this._WHITE = new THREE.Color(0xffffff);
    this._FROST = new THREE.Color(0x8fe3ff);
    this._mc = new THREE.Color();   // 变异染色临时色
    this._insts = {}; this._outline = {}; this._warned = {};
    this._defaultGeo = new THREE.IcosahedronGeometry(0.7, 0);
    const vset = new Set();
    for (const K in this.SPEC) for (const v of this.SPEC[K].variants) vset.add(v);
    vset.add('__default');
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x05070d, side: THREE.BackSide });  // 反向外壳描边（cel 风）
    // 纯色材质：MeshBasicMaterial + instanceColor —— 兵种本色直接显示，暗场景下也清晰可辨（用户要求"纯色"）
    const bodyMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const vk of vset){
      const geo = vk === '__default' ? this._defaultGeo : (Gfx.enemyBodyGeo(vk) || this._defaultGeo);
      if (vk !== '__default' && geo === this._defaultGeo && !this._warned[vk]){
        this._warned[vk] = 1; console.warn('[Enemies] Missing enemy geo, fallback icosa: ' + vk);
      }
      const inst = new THREE.InstancedMesh(geo, bodyMat(), 300);
      inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      inst.frustumCulled = false;
      inst.count = 0;
      inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(300 * 3), 3);
      World.scene.add(inst);
      this._insts[vk] = inst;
      // 描边壳：复用同几何，BackSide + 偏大 6%，仅作纯黑轮廓（实例化后丢失的 cel 描边回归）
      const oinst = new THREE.InstancedMesh(geo, outlineMat, 300);
      oinst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      oinst.frustumCulled = false;
      oinst.count = 0;
      oinst.renderOrder = -1;
      World.scene.add(oinst);
      this._outline[vk] = oinst;
    }
  },

  /**
   * @param kind   种类
   * @param hpMul  血量倍率
   * @param spdMul 速度倍率
   * @param scale  体型
   * @param elite  精英
   */
  spawn(kind, x, z, hpMul, spdMul, scale, elite, tint, allowMut){
    const S = this.SPEC[kind] || this.SPEC.charger;
    if (tint != null) this._curTint = tint;
    const e = this.pool.get();
    if (!e) return null;
    e._pi = ++this._pid;          // 唯一实例 id（供链电/激光/飞锯去重命中）
    e.kind = kind; e.ai = S.ai;
    e.x = x; e.z = z; e.vx = 0; e.vz = 0;
    e.scale = (scale || 1) * (elite ? 1.5 : 1);
    e.r = S.r * e.scale;
    e.maxHp = S.hp * (hpMul == null ? 1 : hpMul) * (elite ? 4.2 : 1);
    e.hp = e.maxHp;
    e.spd = S.spd * (spdMul == null ? 1 : spdMul) * (elite ? 0.82 : 1);
    e.dmg = S.dmg * (elite ? 1.6 : 1);
    e.xp = S.xp * (elite ? 7 : 1);
    e.elite = !!elite;
    // 变异：默认允许（普通刷怪），分裂子代/召唤传 false 防递归
    const mut = this._rollMut(allowMut !== false, e.elite);
    e.mut = mut; e.mutT = 0; e.raging = false; e.spdMul = 1; e.dmgMul = 1;
    if (mut){
      const M = this.MUT[mut];
      e.maxHp = Math.max(1, Math.round(e.maxHp * (M.hp || 1)));
      e.hp = e.maxHp;
      e.spdMul *= (M.spd || 1);
    }
    e.t = Math.random() * 10; e.fireCd = Util.rand(0.6, 2.2);
    e.blinkCd = Util.rand(1.4, 3.0) + (e.ai === 'blink' ? 1 : 0);
    e.healCd  = Util.rand(1.5, 3.0) + (e.ai === 'support' ? 1 : 0);
    e.hitT = 0; e.slowT = 0; e.slowK = 0; e.frostLv = 0; e.frostT = 0;
    const _tp0 = Game.nearestPlayer(x, z) || { x: 0, z: 0 };
    e.yaw = Math.atan2(_tp0.x - x, _tp0.z - z);
    e.chargeT = 0; e.chargeCd = Util.rand(4.5, 7.5);

    // 机型多样化：从本种类的机型池里随机抽一个（颜色仍按种类，保证威胁辨识度）
    const mk = S.variants[Math.floor(Math.random() * S.variants.length)];
    e.modelKey = mk;
    // 精英暖金；常规敌人按「兵种本色」S.color，再叠 18% 舰队阵营色（scrap/void/abyss 可辨但兵种本色仍主导）
    const fac = EFAC[kind];
    const col = elite ? 0xffe0a0
      : (fac ? (new THREE.Color(S.color)).lerp(new THREE.Color(FAC[fac]), 0.18).getHex() : S.color);
    e.color = col;
    if (elite){
      FX.ring(x, z, 0xffcc33, 4 * e.scale, 0.5);
      World.shake(0.6, 0.2);
    }
    return e;
  },

  /** 半径查询（先空间哈希，再精确距离） */
  queryHit(x, z, r){
    const cand = Grid.query(x, z, r + 2.2);
    const out = [];
    for (let i = 0; i < cand.length; i++){
      const e = cand[i];
      if (!e.alive) continue;
      const rr = r + e.r;
      if (Util.dist2(x, z, e.x, e.z) <= rr * rr) out.push(e);
    }
    return out;
  },

  damage(e, dmg, crit, hx, hz, fx){
    // BOSS 轻量目标桩（Boss.asTarget）没有敌人字段；命中时委托给 Boss.damage，统一走 BOSS 受伤/死亡路径
    if (e && e.isBoss){ Boss.damage(dmg, crit, hx, hz); return; }
    if (!e || !e.alive) return;
    let actual = dmg * Synergy.mods.dmg;
    if (e.frostLv > 0 && e.frostT > 0) actual *= 1.5;   // 冷冻射线：冻结期受伤加成
    e.hp -= actual;
    e.hitT = Math.max(e.hitT, 0.1);
    Game.dmgDealt += actual;
    if (fx !== false){            // fx=false 时走静默路径（黑洞/牵引/相阵等持续 DOT，避免刷屏）
      FX.dmgText(hx == null ? e.x : hx, hz == null ? e.z : hz, actual, crit);
      FX.hitSpark(e.x, e.z, e.color || this.SPEC[e.kind].color, 0.8);
      const kb = 5.5 / e.scale;        // 轻微击退（体型越大越稳）
      const _tp = Game.nearestPlayer(e.x, e.z) || { x: e.x, z: e.z };
      const a = Math.atan2(e.x - _tp.x, e.z - _tp.z);
      e.vx += Math.sin(a) * kb; e.vz += Math.cos(a) * kb;
      if (e.hp <= 0) this.kill(e);
      else Audio2.hit();
    } else if (e.hp <= 0) this.kill(e);
  },

  // 减速（离子干扰炮命中）：复用现有 slow 系统（update 内乘 1-slowK）
  slow(e, dur, k){ if (!e || !e.alive) return; e.slowT = Math.max(e.slowT || 0, dur); e.slowK = k; },
  // 瘫痪（EMP 鱼雷）：定身一段时间，期间不移动/不攻击
  stun(e, dur){ if (!e || !e.alive) return; e.stun = Math.max(e.stun || 0, dur); },
  // EMP 鱼雷：全场敌人瘫痪 + 一次范围伤害（静默路径避免刷屏）
  emp(){
    const a = this.pool.active;
    for (const e of a){
      if (!e.alive) continue;
      e.stun = Math.max(e.stun || 0, 2.2);
      this.damage(e, 30, false, e.x, e.z, false);
    }
  },

  splash(x, z, r, dmg, crit){
    if (!r) return;
    const hits = this.queryHit(x, z, r);
    for (const e of hits){
      const d = Math.hypot(e.x - x, e.z - z);
      const f = Util.clamp(1 - d / (r + e.r), 0.35, 1);
      this.damage(e, dmg * f, crit, e.x, e.z);
    }
  },

  kill(e){
    // 立刻下线，避免「溅射打到正在死的自己 / 旁边的重甲」造成 kill→splash→kill 死循环
    if (!e.alive) return;
    e.alive = false;
    const S = this.SPEC[e.kind];
    FX.explode(e.x, e.z, e.color || S.color, e.elite ? 1.9 : (0.7 + e.scale * 0.4));
    Audio2.kill();
    if (e.elite) World.shake(0.9, 0.26);
    Game.kills++;

    // 掉经验
    const v = e.xp;
    if (v >= 8)      Loot.dropGem(e.x, e.z, 20);
    else if (v >= 3) Loot.dropGem(e.x, e.z, 5);
    else             Loot.dropGem(e.x, e.z, 1);
    if (e.elite){
      for (let i = 0; i < 4; i++)
        Loot.dropGem(e.x + Util.rand(-2, 2), e.z + Util.rand(-2, 2), 20);
    }
    // 小概率掉修复包
    if (Math.random() < (e.elite ? 0.55 : 0.017)) Loot.dropHeal(e.x, e.z);
    // 太空补给箱：小概率掉落道具（护盾电池/能量核心/维修包/引擎过载/EMP）
    if (Math.random() < (e.elite ? 0.42 : 0.05)) Loot.dropItem(e.x, e.z);

    // 分裂（敌种机制）
    if (e.kind === 'splitter' && e.scale > 0.55){
      for (let i = 0; i < 2; i++){
        const a = Math.random() * Util.TAU;
        const c = this.spawn('charger', e.x + Math.cos(a) * 1.4, e.z + Math.sin(a) * 1.4,
          Math.max(0.4, e.maxHp / this.SPEC.charger.hp * 0.30), 1.25, e.scale * 0.62, false, this._curTint, false);
        if (c){ c.vx = Math.cos(a) * 14; c.vz = Math.sin(a) * 14; }
      }
    }
    // 死亡爆裂：进队列，下一帧迭代结算，杜绝连锁递归（brute / bomber 各自参数）
    if (e.kind === 'brute'){
      FX.ring(e.x, e.z, 0xff7a2f, 9, 0.5);
      this.blastQ.push(e.x, e.z, 6.5, 26);
      const _tp = Game.nearestPlayer(e.x, e.z);
      if (_tp && Util.dist2(e.x, e.z, _tp.x, _tp.z) < 42) _tp.takeDamage(Game.hell ? _tp.maxHp * CFG.hell.collideMul : 10);
    } else if (e.kind === 'bomber'){
      const r = 5.5 * e.scale, d = 20 * e.scale;
      FX.ring(e.x, e.z, 0xff4422, r, 0.5);
      FX.explode(e.x, e.z, 0xff6633, 1.6);
      this.blastQ.push(e.x, e.z, r, d);
      World.shake(0.8, 0.25);
    }
    // 裂变变异：死亡裂出 2 只小型追击者（仅一代，scale 守卫防递归）
    if (e.mut === 'split' && e.scale > 0.5){
      for (let i = 0; i < 2; i++){
        const a = Math.random() * Util.TAU;
        const c = this.spawn('charger', e.x + Math.cos(a) * 1.3, e.z + Math.sin(a) * 1.3,
          Math.max(0.4, e.maxHp / this.SPEC.charger.hp * 0.30), 1.2, e.scale * 0.6, false, this._curTint, false);
        if (c){ c.vx = Math.cos(a) * 12; c.vz = Math.sin(a) * 12; }
      }
    }

    this.pool.release(e);
  },

  update(dt){
    // 重建空间哈希
    Grid.clear();
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++) Grid.insert(list[i]);

    // 结算死亡爆裂：迭代而非递归，并设上限防止极端情况刷屏（队列存 [x,z,r,dmg]）
    let guard = 0;
    while (this.blastQ.length >= 4 && guard++ < 64){
      const dmg = this.blastQ.pop(), r = this.blastQ.pop(),
            bz = this.blastQ.pop(), bx = this.blastQ.pop();
      this.splash(bx, bz, r, dmg, false);
    }
    if (this.blastQ.length) this.blastQ.length = 0;

    const px = Player.x, pz = Player.z;

    this.pool.each(e => {
      e.t += dt;
      if (e.hitT > 0) e.hitT -= dt;
      // 瘫痪（EMP 鱼雷）：定身期间不主动移动/不攻击，仅衰减惯性并仍可被击退
      if (e.stun > 0){
        e.stun -= dt;
        e.vx *= Math.exp(-4 * dt); e.vz *= Math.exp(-4 * dt);
        e.x += e.vx * dt; e.z += e.vz * dt;
        Util.clampArena(e, e.r);
        return;
      }
      let sk = 1;
      const tp = Game.nearestPlayer(e.x, e.z);
      const px = tp ? tp.x : e.x, pz = tp ? tp.z : e.z;
      if (e.slowT > 0){ e.slowT -= dt; sk = 1 - e.slowK; }

      /* ---- 变异持续效果 ---- */
      if (e.mut === 'regen' && e.hp < e.maxHp){
        e.hp = Math.min(e.maxHp, e.hp + 6 * dt);
        e.mutT += dt;
        if (e.mutT > 1.2){ e.mutT = 0; FX.ring(e.x, e.z, 0x6dff8b, e.r * 2.4, 0.3); }
      }
      if (e.mut === 'berserk'){
        const rage = e.hp / e.maxHp < 0.35;
        if (rage !== e.raging){
          e.raging = rage;
          if (rage) FX.ring(e.x, e.z, 0xff4d4d, e.r * 2.6, 0.4);
        }
      }

      const dx = px - e.x, dz = pz - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const toP = Math.atan2(dx, dz);
      let ax = 0, az = 0;

      /* ---- AI ---- */
      if (e.ai === 'chase'){
        ax = dx / dist; az = dz / dist;
      } else if (e.ai === 'rush'){
        // 自杀冲锋：全速扑向玩家，不考虑分离
        ax = dx / dist; az = dz / dist;
      } else if (e.ai === 'turret'){
        // 固定炮台：原地不动，缓慢转向并周期射击
        ax = 0; az = 0;
        e.yaw = Math.atan2(dx, dz);
        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < 40 && Game.state === 'PLAYING'){
          e.fireCd = Util.rand(1.4, 2.2);
          Bullets.enemyFire(e.x, e.z, Math.atan2(dx, dz), 26, e.dmg * (e.dmgMul || 1) * (e.mut === 'berserk' && e.raging ? 1.8 : 1),
            { color: 0xffc04d, scale: 0.8, life: 4 });
          FX.burst(e.x, e.z, 0xffc04d, 4, 3, 0.9);
        }
      } else if (e.ai === 'orbit'){
        // 保持 11 单位环绕，并周期开火
        const want = 11;
        const radial = (dist - want) / want;
        const tang = 1;
        ax = (dx / dist) * radial * 1.8 - (dz / dist) * tang;
        az = (dz / dist) * radial * 1.8 + (dx / dist) * tang;
        const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < 26 && Game.state === 'PLAYING'){
          e.fireCd = Util.rand(1.6, 2.6);
          Bullets.enemyFire(e.x, e.z, toP, 22, e.dmg * (e.dmgMul || 1) * (e.mut === 'berserk' && e.raging ? 1.8 : 1), { color: 0xb980ff, scale: 0.9 });
        }
      } else if (e.ai === 'snipe'){
        // 远则靠近，近则后撤；停稳后打高速弹
        const want = 19;
        const k = dist > want + 3 ? 1 : (dist < want - 4 ? -1 : 0);
        ax = (dx / dist) * k; az = (dz / dist) * k;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < 34 && Game.state === 'PLAYING'){
          e.fireCd = Util.rand(2.2, 3.4);
          // 预判玩家速度
          const lead = dist / 40;
          const tx = px + tp.vx * lead, tz = pz + tp.vz * lead;
          const a = Math.atan2(tx - e.x, tz - e.z);
          Bullets.enemyFire(e.x, e.z, a, 40, e.dmg * (e.dmgMul || 1) * (e.mut === 'berserk' && e.raging ? 1.8 : 1), { color: 0x4dd2ff, scale: 0.75, life: 3 });
          FX.burst(e.x, e.z, 0x4dd2ff, 4, 3, 0.9);
        }
      } else if (e.ai === 'support'){
        // 治愈者：与玩家保持距离（优先保命），周期治疗附近受伤友军
        const want = 15;
        const k = dist > want + 3 ? 1 : (dist < want - 4 ? -1 : 0);
        ax = (dx / dist) * k; az = (dz / dist) * k;
        e.healCd -= dt;
        if (e.healCd <= 0 && Game.state === 'PLAYING'){
          e.healCd = 3.0;
          const heal = 14, rad = 11;
          const near = Grid.query(e.x, e.z, rad);
          let any = false;
          for (let i = 0; i < near.length; i++){
            const o = near[i];
            if (o === e || !o.alive || o.hp >= o.maxHp) continue;
            o.hp = Math.min(o.maxHp, o.hp + heal);
            o.hitT = Math.max(o.hitT, 0.10);   // 轻微亮闪提示（颜色仍按种类，避免永久染色）
            any = true;
          }
          if (any){ FX.ring(e.x, e.z, 0x6dff8b, rad, 0.45); FX.ring(e.x, e.z, 0x9dff7a, rad * 0.6, 0.3); }
        }
      } else if (e.ai === 'blink'){
        // 折跃者：平时缓慢逼近，冷却一到就朝玩家瞬移一段，制造追踪压力
        ax = dx / dist * 0.5; az = dz / dist * 0.5;
        e.blinkCd -= dt;
        if (e.blinkCd <= 0 && dist > 6 && Game.state === 'PLAYING'){
          e.blinkCd = Util.rand(2.4, 3.6);
          const step = Math.min(9, dist - 3);
          const bx = e.x + (dx / dist) * step, bz = e.z + (dz / dist) * step;
          if (Math.hypot(bx, bz) < CFG.arena - 1){
            FX.ring(e.x, e.z, 0xc77dff, 2.2, 0.4);
            e.x = bx; e.z = bz;
            e.vx = 0; e.vz = 0;
            FX.ring(e.x, e.z, 0xc77dff, 2.2, 0.4);
            FX.burst(e.x, e.z, 0xc77dff, 6, 3, 1.1);
          }
        }
      } else if (e.ai === 'bomber'){
        // 爆裂体：蓄势逼近（越近越快），接触或死亡都会炸（kill 走 blastQ）
        const accel = Util.clamp(1 + (20 - dist) * 0.04, 1, 2.1);
        ax = (dx / dist) * accel; az = (dz / dist) * accel;
        e.mutT += dt;   // 脉冲计时（视觉可扩展）
      } else if (e.ai === 'weave'){
        // 相位编织者：保持中距环绕走位 + 三连爆发，机动难瞄
        const want = 14;
        const radial = (dist - want) / want;
        ax = (dx / dist) * radial * 1.6 - (dz / dist) * 1.0;
        az = (dz / dist) * radial * 1.6 + (dx / dist) * 1.0;
        const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
        e.fireCd -= dt;
        if (e.fireCd <= 0 && dist < 30 && Game.state === 'PLAYING'){
          e.fireCd = Util.rand(1.8, 2.8);
          const base = Math.atan2(dx, dz);
          const ed = e.dmg * (e.dmgMul || 1) * (e.mut === 'berserk' && e.raging ? 1.8 : 1);
          for (let b = 0; b < 3; b++){
            const a = base + (b - 1) * 0.14;
            Bullets.enemyFire(e.x, e.z, a, 30, ed, { color: 0x9d6bff, scale: 0.8, life: 3 });
          }
          FX.burst(e.x, e.z, 0x9d6bff, 5, 3, 0.9);
        }
      } else if (e.ai === 'warlord'){
        // 战帅（小Boss）：缓慢逼近，周期环形弹幕 + 蓄力突进
        ax = dx / dist * 0.7; az = dz / dist * 0.7;
        if (e.chargeT > 0){
          e.chargeT -= dt;
          ax = Math.sin(e.yaw); az = Math.cos(e.yaw);   // 突进方向锁定
          if (tp && Util.dist2(e.x, e.z, tp.x, tp.z) < (e.r + CFG.player.radius) ** 2)
            tp.takeDamage(Game.hell ? tp.maxHp * CFG.hell.collideMul : 22);
        } else {
          e.yaw = Math.atan2(dx, dz);
          e.fireCd -= dt; e.chargeCd -= dt;
          if (e.fireCd <= 0 && dist < 46 && Game.state === 'PLAYING'){
            e.fireCd = 3.2;
            const n = 16;
            for (let i = 0; i < n; i++){
              const a = i / n * Util.TAU + e.t * 0.5;
              Bullets.enemyFire(e.x + Math.sin(a) * e.r, e.z + Math.cos(a) * e.r, a, 18,
                e.dmg * 0.5 * (e.dmgMul || 1), { color: 0xff2d6d, scale: 1.1, life: 5 });
            }
            FX.ring(e.x, e.z, 0xff2d6d, e.r * 2.6, 0.5);
          }
          if (e.chargeCd <= 0){
            e.chargeCd = 7.5; e.chargeT = 0.9;
            HUD.toast('战帅突进！', '', '#ff2d6d', 0.6); World.shake(1.0, 0.25);
          }
        }
      }

      /* ---- 敌我分离：防止叠成一坨（炮台固定不动，跳过）---- */
      if (e.ai !== 'turret'){
        const near = Grid.query(e.x, e.z, e.r * 2.4);
        let sx = 0, sz = 0;
        for (let i = 0; i < near.length; i++){
          const o = near[i];
          if (o === e || !o.alive) continue;
          const ddx = e.x - o.x, ddz = e.z - o.z;
          const d2 = ddx*ddx + ddz*ddz;
          const rr = (e.r + o.r) * 0.92;
          if (d2 < rr * rr && d2 > 0.0001){
            const d = Math.sqrt(d2);
            sx += ddx / d * (1 - d / rr);
            sz += ddz / d * (1 - d / rr);
          }
        }
        ax += sx * 1.7; az += sz * 1.7;
      }

      // 躲避陨石：像怕一样绕开，避免穿模
      {
        const aa = Asteroids.pool.active;
        for (let j = 0; j < aa.length; j++){
          const o = aa[j]; if (!o.alive) continue;
          const adx = e.x - o.x, adz = e.z - o.z;
          const ad2 = adx*adx + adz*adz;
          const ar = e.r + o.r + 1.8;
          if (ad2 < ar*ar && ad2 > 0.001){
            const d = Math.sqrt(ad2);
            const f = (1 - d / ar) * 2.4;
            ax += adx / d * f; az += adz / d * f;
          }
        }
      }

      const sp = e.spd * (e.spdMul || 1) * (e.mut === 'berserk' && e.raging ? 1.25 : 1) * sk;
      const k = 1 - Math.exp(-7 * dt);
      e.vx += (ax * sp - e.vx) * k;
      e.vz += (az * sp - e.vz) * k;
      e.x += e.vx * dt; e.z += e.vz * dt;
      Util.clampArena(e, e.r);
      // 硬解算：绝不嵌入陨石（推出 + 抵消指向岩石的速度分量）
      {
        const ao = Asteroids.hitTest(e.x, e.z, e.r * 0.9);
        if (ao){
          const adx = e.x - ao.x, adz = e.z - ao.z;
          const d = Math.hypot(adx, adz) || 0.001;
          const need = (e.r * 0.9 + ao.r) - d;
          if (need > 0){ e.x += adx / d * need; e.z += adz / d * need; }
          const nx = adx / d, nz = adz / d;
          const vn = e.vx * nx + e.vz * nz;
          if (vn < 0){ e.vx -= vn * nx; e.vz -= vn * nz; }
        }
      }

      /* ---- 撞击玩家（目标为最近玩家） ---- */
      const pr = CFG.player.radius + e.r;
      if (dist < pr && Game.state === 'PLAYING' && tp){
        // 地狱模式：撞击伤害 = 玩家总血量 × 1/4（用户要求）；常规模式沿用兵种伤害
        const dmg = Game.hell ? tp.maxHp * CFG.hell.collideMul
                               : e.dmg * (e.dmgMul || 1) * (e.mut === 'berserk' && e.raging ? 1.8 : 1);
        if (e.kind === 'kamikaze'){
          // 自杀冲锋：撞上即引爆，自身摧毁
          tp.takeDamage(dmg);
          FX.explode(e.x, e.z, 0xff5a3c, 1.4);
          World.shake(1.2, 0.3);
          this.kill(e);
        } else if (e.kind === 'bomber'){
          // 爆裂体：接触即引爆
          tp.takeDamage(dmg);
          FX.explode(e.x, e.z, 0xff4422, 1.6);
          World.shake(1.0, 0.28);
          this.kill(e);          // kill 里走 blastQ 做范围爆裂
        } else {
          tp.takeDamage(dmg);
          const a = Math.atan2(e.x - px, e.z - pz);
          e.vx = Math.sin(a) * 16; e.vz = Math.cos(a) * 16;
        }
        if (e.mut === 'toxic') tp.applyPoison(3, 2.5);
      }

      /* ---- 表现（位置/朝向/受击闪白统一留到 _flush 写 InstancedMesh 矩阵与 instanceColor）---- */
      if (e.frostT > 0) e.frostT -= dt;
      e.yaw = Util.angLerp(e.yaw, Math.atan2(e.vx, e.vz) || e.yaw, 1 - Math.exp(-8 * dt));
      return false;
    });
    this._flush();
  },

  /** 把活跃敌人按 modelKey 分桶写入各自的 InstancedMesh（矩阵 + instanceColor） */
  _flush(){
    for (const k in this._insts){ this._insts[k].count = 0; this._outline[k].count = 0; }
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++){
      const e = list[i];
      const inst = this._insts[e.modelKey] || this._insts.__default;
      if (!inst) continue;
      const idx = inst.count++;
      const spin = (e.kind === 'orbiter' || e.kind === 'splitter');
      const ry = spin ? e.t * 1.6 : e.yaw;
      const hf = e.hitT > 0 ? e.hitT / 0.1 : 0;
      const bob = 0.65 * e.scale + Math.sin(e.t * 3 + e.x) * 0.08;
      this._p.set(e.x, bob, e.z);
      this._q.setFromEuler(this._e.set(0, ry, 0));
      const sc = e.scale * (hf > 0 ? 1 + hf * 0.13 : 1);
      this._s.setScalar(sc);
      this._m.compose(this._p, this._q, this._s);
      inst.setMatrixAt(idx, this._m);
      if (hf > 0) this._c.setHex(e.color).lerp(this._WHITE, hf * 0.85);
      else if (e.frostT > 0) this._c.setHex(e.color).lerp(this._FROST, Math.min(0.85, 0.4 + e.frostLv / 3 * 0.5));
      else this._c.setHex(e.color);
      if (e.mut) this._c.lerp(this._mc.setHex(this.MUT[e.mut].color), 0.5);   // 变异直接染敌体发光，去除地面光环
      inst.instanceColor.setXYZ(idx, this._c.r, this._c.g, this._c.b);
      // 反向外壳描边（纯黑 BackSide，偏大 6%）
      const oinst = this._outline[e.modelKey] || this._outline.__default;
      if (oinst){
        this._s.setScalar(sc * 1.06);
        this._m.compose(this._p, this._q, this._s);
        oinst.setMatrixAt(oinst.count++, this._m);
      }
    }
    for (const k in this._insts){
      const inst = this._insts[k];
      if (inst.count > 0){
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      }
      const oinst = this._outline[k];
      if (oinst && oinst.count > 0) oinst.instanceMatrix.needsUpdate = true;
    }
  },

  clear(){
    this.blastQ.length = 0;
    this.pool.releaseAll();
    for (const k in this._insts) this._insts[k].count = 0;
  },
};

/* ============================ Loot 掉落（InstancedMesh + 磁吸） ============================ */
const Loot = {
  inst: null, pool: null,
  _m: new THREE.Matrix4(), _q: new THREE.Quaternion(),
  _p: new THREE.Vector3(), _s: new THREE.Vector3(1, 1, 1), _c: new THREE.Color(),
  _ax: new THREE.Vector3(0, 1, 0),

  init(){
    const geo = new THREE.OctahedronGeometry(0.34, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });   // 颜色由 instanceColor 驱动
    this.inst = new THREE.InstancedMesh(geo, mat, 400);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inst.frustumCulled = false;
    this.inst.renderOrder = 5;
    this.inst.count = 0;
    this.inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(400 * 3), 3);
    World.scene.add(this.inst);
    this.pool = Pool.create(400, () => ({
      x:0, z:0, y:0.55, vx:0, vz:0, val:1, kind:'xp', t:0, mag:false,
      _sc:0.85, _color:0x38f0ff, alive:false,
    }));
  },

  _put(x, z, val, kind, color, scale){
    const o = this.pool.get(); if (!o) return null;
    o.x = x; o.z = z; o.y = 0.55; o.val = val; o.kind = kind;
    o.t = Math.random() * 6; o.mag = false; o._sc = scale; o._color = color;
    const a = Math.random() * Util.TAU, sp = Util.rand(2, 6);
    o.vx = Math.cos(a) * sp; o.vz = Math.sin(a) * sp;
    return o;
  },

  dropGem(x, z, val){
    const c = val >= 20 ? 0xb980ff : (val >= 5 ? 0x5dff9b : 0x38f0ff);
    const s = val >= 20 ? 1.5 : (val >= 5 ? 1.15 : 0.85);
    return this._put(x, z, val, 'xp', c, s);
  },

  dropHeal(x, z){ return this._put(x, z, 25, 'hp', 0xff3d7f, 1.35); },

  // 太空补给箱：护盾电池 / 能量核心 / 维修包 / 引擎过载 / EMP 鱼雷
  ITEMS: {
    repair:  { name:'维修包',   color:0x5dff9b, scale:1.30 },
    battery: { name:'护盾电池', color:0x6de0ff, scale:1.25 },
    boost:   { name:'引擎过载', color:0xffcc33, scale:1.15 },
    core:    { name:'能量核心', color:0xff8a3d, scale:1.22 },
    emp:     { name:'EMP 鱼雷', color:0xb980ff, scale:1.38 },
  },
  dropItem(x, z, kind){
    const k = kind || Util.pick(['repair', 'battery', 'boost', 'core', 'emp']);
    const cfg = this.ITEMS[k];
    return this._put(x, z, 0, k, cfg.color, cfg.scale);
  },

  update(dt){
    this.pool.each(o => {
      o.t += dt;
      const k = Math.exp(-5 * dt); o.vx *= k; o.vz *= k;
      o.x += o.vx * dt; o.z += o.vz * dt;
      // 双人：吸附到最近且在拾取范围内的存活玩家（经验归该玩家）
      let best = null, bd = Infinity;
      for (const p of Game.alivePlayers()){
        const pr = p.pickR, d2 = Util.dist2(o.x, o.z, p.x, p.z);
        if (o.mag || d2 < pr * pr){ if (d2 < bd){ bd = d2; best = p; } }
      }
      if (best){
        o.mag = true;
        const d = Math.sqrt(bd) || 1;
        const sp = CFG.magnetSpd * Util.clamp(1.4 - d / 22, 0.55, 1.6);
        o.x += (best.x - o.x) / d * sp * dt;
        o.z += (best.z - o.z) / d * sp * dt;
        if (d < 1.3){ this._collect(o, best); return true; }
      }
      return false;
    });
    // 写矩阵 + 实例色
    const a = this.pool.active, n = a.length;
    for (let i = 0; i < n; i++){
      const o = a[i];
      const bob = 0.55 + Math.sin(o.t * 3.4) * 0.16;
      this._p.set(o.x, bob, o.z);
      this._q.setFromAxisAngle(this._ax, o.t * 2.1);
      this._s.set(o._sc, o._sc, o._sc);
      this._m.compose(this._p, this._q, this._s);
      this.inst.setMatrixAt(i, this._m);
      this._c.setHex(o._color);
      this.inst.instanceColor.setXYZ(i, this._c.r, this._c.g, this._c.b);
    }
    this.inst.count = n;
    if (n > 0){
      this.inst.instanceMatrix.needsUpdate = true;
      this.inst.instanceColor.needsUpdate = true;
    }
  },

  /** 拾取道具/经验/修复包，按 kind 生效 */
  _collect(o, p){
    Audio2.gem();
    switch (o.kind){
      case 'hp':
        p.heal(o.val);
        FX.particle(o.x, 0.8, o.z, 0xff3d7f, { life: 0.3, s0: 0.55, s1: 0, drag: 4 });
        break;
      case 'repair':
        p.heal(35); HUD.toast('维修包  +35 结构', '', '#5dff9b', 0.8);
        FX.particle(o.x, 0.8, o.z, 0x5dff9b, { life: 0.3, s0: 0.6, s1: 0, drag: 4 });
        break;
      case 'battery':
        p.shieldLayer = Math.min(3, p.shieldLayer + 1);
        HUD.toast('护盾电池  +1 层', '', '#6de0ff', 0.8);
        FX.ring(o.x, o.z, 0x6de0ff, 3, 0.3);
        break;
      case 'boost':
        p.buffs.engine = 6; HUD.toast('引擎过载  移速+50% 6s', '', '#ffcc33', 0.8);
        FX.ring(o.x, o.z, 0xffcc33, 3, 0.3);
        break;
      case 'core':
        p.buffs.overdrive = 8; HUD.toast('能量核心  射速+40% 8s', '', '#ff8a3d', 0.8);
        FX.ring(o.x, o.z, 0xff8a3d, 3, 0.3);
        break;
      case 'emp':
        Enemies.emp(); HUD.toast('EMP 鱼雷  全场瘫痪', '', '#b980ff', 1.2);
        FX.ring(p.x, p.z, 0xb980ff, 42, 0.6);
        break;
      default:
        p.progress.gainExp(o.val);
        FX.particle(o.x, 0.8, o.z, 0x9df6ff, { life: 0.3, s0: 0.55, s1: 0, drag: 4 });
    }
  },

  /** 全屏吸取（升级奖励用） */
  magnetAll(){ for (const o of this.pool.active) o.mag = true; },

  clear(){ this.pool.releaseAll(); this.inst.count = 0; },
};

/* ============================ Hazards 场景危害 ============================ */
/* 可踩可躲的中立环境危害：等离子风暴 / 熔火地带 / 引力裂隙。
 * 周期性在远离玩家的位置生成圆形危害区，玩家踩入按 tick 持续掉血（绕过 i-frame），
 * 区内敌人也会被波及（增加走位博弈）。提供 init/reset/update 三步接入 Game 主循环。*/
const Hazards = {
  group: null, list: [], spawnT: 7,
  // 坏区（太空危害）：踩入持续受伤（绕无敌帧），区内也削敌人
  BAD: [
    { key:'storm', name:'等离子风暴', color:0x9d6bff, r:7.5, dps:16 },
    { key:'flare', name:'恒星耀斑带', color:0xff6a3c, r:6.5, dps:12 },
    { key:'void',  name:'引力裂隙',   color:0x4dffa0, r:8.5, dps:9  },
    { key:'rad',   name:'辐射云团',   color:0xffd24d, r:7.0, dps:10 },
  ],
  // 好区（太空援护）：进入获得增益 —— 场景触发「有好有坏」
  GOOD: [
    { key:'repair', name:'维修立场',     color:0x5dff9b, r:6.5, hps:16 },   // 站在里面持续回血
    { key:'rally',  name:'友军炮台立场', color:0x8dfcff, r:7.0 },            // 召唤友军炮台帮你打（更多友军）
  ],
  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);
  },
  reset(){ this.spawnT = 7; for (const h of this.list) this._rm(h); this.list.length = 0; },
  // 友军炮台网格（友军炮台立场召唤的「更多友军」）
  _mkAlly(x, z){
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.72, 0.5, 12),
      new THREE.MeshLambertMaterial({ color:0x2a6f8f, emissive:0x10303a }));
    base.position.y = 0.25;
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 1.25),
      new THREE.MeshLambertMaterial({ color:0x8dfcff, emissive:0x1c6f7a }));
    barrel.position.set(0, 0.55, 0.5);
    g.add(base); g.add(barrel);
    g.position.set(x, 0, z);
    this.group.add(g);
    return { g, x, z, fireCd: Math.random() * 0.5 };
  },
  _mk(forceKey){
    let T;
    if (forceKey) T = (this.BAD.concat(this.GOOD)).find(t => t.key === forceKey) || Util.pick(this.BAD);
    else { const good = Math.random() < 0.45; T = good ? Util.pick(this.GOOD) : Util.pick(this.BAD); }  // 约 45% 刷好区
    // 不在玩家脸上刷：随机方向、距玩家 16~36，最多试 8 次避开近身
    let x = 0, z = 0, ok = false, tries = 0;
    while (!ok && tries < 8){
      tries++;
      const a = Math.random() * Util.TAU, d = Util.rand(16, 36);
      x = Math.cos(a) * d; z = Math.sin(a) * d;
      ok = Game.players.every(p => Math.hypot(x - p.x, z - p.z) > 13) &&
           Math.hypot(x, z) < CFG.arena - 2;
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(T.r, 44),
      new THREE.MeshBasicMaterial({ color: T.color, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.08;
    const ring = new THREE.Mesh(new THREE.RingGeometry(T.r * 0.94, T.r, 52),
      new THREE.MeshBasicMaterial({ color: T.color, transparent: true, opacity: 0.65,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1;
    this.group.add(disc); this.group.add(ring);
    const h = { x, z, r: T.r, def: T, disc, ring, life: Util.rand(8, 11), tickT: 0, allies: [] };
    if (T.key === 'rally'){                    // 友军炮台立场：召唤 2 座友军炮台
      h.allies.push(this._mkAlly(x - 1.4, z));
      h.allies.push(this._mkAlly(x + 1.4, z));
    }
    this.list.push(h);
    FX.ring(x, z, T.color, T.r, 0.7);
    const good = this.GOOD.indexOf(T) >= 0;
    HUD.toast(good ? ('✚ 友军增援：' + T.name) : ('⚠ 星域异常：' + T.name),
              '', good ? '#5dff9b' : '#ff6a3c', 1.0);
    return h;
  },
  update(dt){
    this.spawnT -= dt;
    if (this.spawnT <= 0 && Game.state === 'PLAYING' && this.list.length < 4){
      this.spawnT = Util.rand(7, 10); this._mk();
    }
    for (let i = this.list.length - 1; i >= 0; i--){
      const h = this.list[i];
      h.life -= dt;
      const fade = Util.clamp(h.life / 1.4, 0, 1);
      h.disc.material.opacity = 0.18 * fade;
      h.ring.material.opacity = 0.65 * fade;
      h.ring.rotation.z += dt * 1.3;
      h.disc.rotation.z -= dt * 0.6;
      h.tickT -= dt;
      const inAny = Game.alivePlayers().some(p => Util.dist2(h.x, h.z, p.x, p.z) < h.r * h.r);
      // 友军炮台立场：友军炮台周期朝最近敌人开火（更多友军帮你打）
      if (h.def.key === 'rally'){
        for (const a of h.allies){
          a.fireCd -= dt;
          const near = Enemies.queryHit(a.x, a.z, 26);
          let best = null, bd = 1e9;
          for (const e of near){ const d = (e.x - a.x) * (e.x - a.x) + (e.z - a.z) * (e.z - a.z); if (d < bd){ bd = d; best = e; } }
          if (best){
            const dir = Math.atan2(best.x - a.x, best.z - a.z);
            a.g.rotation.y = dir;
            if (a.fireCd <= 0){
              a.fireCd = 0.5;
              const dmg = 11 + (Game.wave || 1) * 0.6;
              Bullets.fire(a.x, a.z, dir, 24, dmg, { color:0x8dfcff, r:0.4 });
              FX.burst(a.x + Math.sin(dir) * 0.9, a.z + Math.cos(dir) * 0.9, 0x8dfcff, 2, 2, 0.7);
            }
          }
        }
      }
      if (h.tickT <= 0){
        h.tickT = 0.4;                         // 每 0.4s 结算一次
        if (h.def.key === 'repair'){
          // 维修立场：站在里面持续回血（双人：每名在立场内的玩家各自回血）
          if (inAny && Game.state === 'PLAYING'){
            const add = h.def.hps * 0.4;
            for (const p of Game.alivePlayers()){
              if (Util.dist2(h.x, h.z, p.x, p.z) < h.r * h.r){
                p.hp = Math.min(p.maxHp, p.hp + add);
                if (Math.random() < 0.6) FX.dmgText(p.x, p.z, '+' + Math.round(add), false, '#5dff9b');
              }
            }
          }
        } else if (h.def.key !== 'rally'){
          // 坏区：伤玩家（绕无敌帧）+ 削敌人
          const hit = h.def.dps * 0.4;
          if (inAny && Game.state === 'PLAYING'){
            for (const p of Game.alivePlayers()){
              if (Util.dist2(h.x, h.z, p.x, p.z) < h.r * h.r){ p.envDmg(hit); FX.burst(p.x, p.z, h.def.color, 3, 2, 1); }
            }
          }
          const near = Enemies.queryHit(h.x, h.z, h.r);   // 中立危害也削敌人（含战帅）
          for (const e of near) Enemies.damage(e, hit * 0.7, false, e.x, e.z);
        }
      }
      if (h.life <= 0) this._rm(h);
    }
  },
  _rm(h){
    if (h.disc) this.group.remove(h.disc);
    if (h.ring) this.group.remove(h.ring);
    if (h.allies) for (const a of h.allies){ if (a.g) this.group.remove(a.g); }
    const i = this.list.indexOf(h); if (i >= 0) this.list.splice(i, 1);
  },
};
