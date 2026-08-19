
/* ============================ Player 玩家 ============================ */
/* 工厂：P1/P2 各自一个实例，逻辑完全相同；P2 用 WASD 控制并独立配色。
   全局 Player 仍是 P1 实例，所有现有 Player. 引用对 P1 继续生效，双人时再引入 Player2。*/
function makePlayer(opts){
  const id = opts.id;
  return {
  id: id, tint: null,
  x: 0, z: 0, vx: 0, vz: 0, yaw: 0,
  hp: 100, maxHp: 100,
  inv: 0,                       // 无敌帧
  buffs: { overdrive: 0, engine: 0 },   // 道具增益：过载(射速) / 引擎(移速)
  shieldLayer: 0,                       // 备用护盾层（护盾电池）：吸收一次撞击
  dashT: 0, dashCd: 0, dashDX: 0, dashDZ: 0,
  group: null, shipG: null, thr: null, glow: null, shield: null,
  phaseMesh: null, phaseHp: 0, phaseMax: 0, phaseT: 0,   // 相位护盾（C②）：吸收伤害的力场
  cfg: null, bob: 0,
  progress: null, weapons: null, leveling: false,

  init(){
    this.cfg = SHIPS[Game.shipIdx || 0];
    this.tint = (this.id === 2) ? 0x4dd2ff : this.cfg.color;   // P2 青色区分，P1 用机型色
    this.group = new THREE.Group();
    this._buildShip();

    this.thr = Gfx.thruster(this.tint, 0.20, -0.85, { opacity: 0.34, core: 0.55 });
    this.thr.position.y = 0.95;
    this.group.add(this.thr);

    this.glow = Gfx.glow(this.tint, 1.8, 0.28);
    this.group.add(this.glow);

    // 受击/无敌时的护盾球
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: this.tint, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.shield.position.y = 1.0;
    this.group.add(this.shield);

    // 相位护盾力场（C②）：吸收伤害的青色球壳，由相位护盾武器充能
    this.phaseMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.phaseMesh.position.y = 1.0;
    this.group.add(this.phaseMesh);

    World.scene.add(this.group);
  },

  /** 按当前 cfg 重建机身（换机型时调用）*/
  _buildShip(){
    if (this.shipG) this.group.remove(this.shipG);
    const built = Gfx.ship(this.cfg.model, this.tint, 1.0);
    this.shipG = built.g; this.mats = built.mats;
    this.shipG.position.y = 0.95;
    this.group.add(this.shipG);
  },

  /** 切换机型（菜单选择后、开局前调用）*/
  setShip(idx){
    this.cfg = SHIPS[idx] || SHIPS[0];
    if (this.id !== 2) this.tint = this.cfg.color;
    this._buildShip();
    if (this.thr)    this.thr.userData.cone.material.color.setHex(this.tint);
    if (this.glow)   this.glow.material.color.setHex(this.tint);
    if (this.shield) this.shield.material.color.setHex(this.tint);
  },

  reset(){
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.yaw = 0;
    this.maxHp = this.cfg.hp; this.hp = this.maxHp;
    this.inv = 0; this.dashT = 0; this.dashCd = 0; this.bob = 0;
    this.buffs.overdrive = 0; this.buffs.engine = 0; this.shieldLayer = 0;
    this.group.visible = true;
    this.group.position.set(0, 0, 0);
    this.shipG.rotation.y = 0;
    this.shield.material.opacity = 0;
    this.phaseHp = 0; this.phaseMax = 0; this.phaseT = 0;
    this.phaseMesh.material.opacity = 0;
    this.poisonT = 0; this.poisonDps = 0;
  },

  get speed(){ return this.cfg.spd * (1 + this.progress.p('speed') * 0.09) * (1 - Synergy.mods.moveSlow) * (this.buffs.engine > 0 ? 1.5 : 1); },
  get fireMul(){ return this.cfg.fire || 1; },
  get armor(){ return this.progress.p('armor') * 0.06 + Synergy.mods.armor; },      // 被动护盾 + 重装共鸣
  get pickR(){ return CFG.pickRadius * (1 + this.progress.p('pick') * 0.34); },

  update(dt){
    if (this.buffs.overdrive > 0) this.buffs.overdrive -= dt;
    if (this.buffs.engine > 0) this.buffs.engine -= dt;
    if (this.poisonT > 0 && (typeof Game === 'undefined' || Game.state === 'PLAYING')){
      this.poisonT -= dt;
      this.hp -= this.poisonDps * dt;
      if (this.hp <= 0){ this.hp = 0; Game.onPlayerDead(this); return; }
    }
    const ip = Input.move(this.id);   // 双玩家输入：P1 方向键 / P2 WASD
    /* --- 冲刺 --- */
    if (this.dashCd > 0) this.dashCd -= dt;
    if (Input.dash(this.id) && this.dashCd <= 0 && (ip.ax || ip.az)){
      this.dashT = CFG.player.dashTime;
      this.dashCd = CFG.player.dashCd;
      this.dashDX = ip.ax; this.dashDZ = ip.az;
      this.inv = Math.max(this.inv, CFG.player.dashTime + 0.12);
      Audio2.dash();
      FX.ring(this.x, this.z, this.tint, 5, 0.3);
    }

    if (this.dashT > 0){
      this.dashT -= dt;
      this.vx = this.dashDX * CFG.player.dashSpd;
      this.vz = this.dashDZ * CFG.player.dashSpd;
      // 残影
      if (Math.random() < 0.7)
        FX.particle(this.x, 0.9, this.z, 0x38f0ff,
          { life: 0.3, s0: 0.6, s1: 0, drag: 6 });
    } else {
      const spd = this.speed;
      const tx = ip.ax * spd, tz = ip.az * spd;
      const acc = (ip.ax || ip.az) ? CFG.player.accel : CFG.player.drag;
      const k = 1 - Math.exp(-acc * dt);
      this.vx += (tx - this.vx) * k;
      this.vz += (tz - this.vz) * k;
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (Util.clampArena(this, CFG.player.radius)){ this.vx *= 0.4; this.vz *= 0.4; }

    /* --- 朝向：优先朝向索敌目标，否则朝移动方向 --- */
    const tgt = this.weapons ? this.weapons.currentTarget : null;
    let want = this.yaw;
    if (tgt && tgt.alive) want = Math.atan2(tgt.x - this.x, tgt.z - this.z);
    else if (Math.hypot(this.vx, this.vz) > 1.2) want = Math.atan2(this.vx, this.vz);
    this.yaw = Util.angLerp(this.yaw, want, 1 - Math.pow(0.0006, dt));

    /* --- 表现 --- */
    this.bob += dt;
    this.group.position.set(this.x, 0, this.z);
    this.shipG.rotation.y = this.yaw;
    this.shipG.position.y = 0.95 + Math.sin(this.bob * 2.4) * 0.07;
    // 转向侧倾
    const spdN = Math.hypot(this.vx, this.vz) / Math.max(1, this.speed);
    const lat = (this.vx * Math.cos(this.yaw) - this.vz * Math.sin(this.yaw)) / Math.max(1, this.speed);
    this.shipG.rotation.z = Util.lerp(this.shipG.rotation.z, -lat * 0.5, 1 - Math.exp(-9 * dt));
    this.shipG.rotation.x = Util.lerp(this.shipG.rotation.x, -spdN * 0.12, 1 - Math.exp(-9 * dt));

    this.thr.rotation.y = this.yaw;
    const tk = 0.55 + spdN * 0.85 + (this.dashT > 0 ? 1.1 : 0);
    this.thr.scale.set(0.8 + spdN * 0.3, 0.8 + spdN * 0.3, tk);
    this.thr.userData.cone.material.opacity = 0.45 + spdN * 0.4;

    // 引擎尾迹（建模精细化：移动时拖一缕同色光尘）
    if (spdN > 0.15 && Math.random() < 0.6)
      FX.particle(this.x - Math.sin(this.yaw) * 1.2, 0.7, this.z - Math.cos(this.yaw) * 1.2,
        this.cfg.color, { life: 0.32, s0: 0.4, s1: 0, drag: 4 });

    if (this.inv > 0){
      this.inv -= dt;
      const f = Math.abs(Math.sin(this.bob * 26));
      this.shield.material.opacity = 0.12 + f * 0.2;
      this.shield.scale.setScalar(1 + f * 0.06);
    } else if (this.shield.material.opacity > 0){
      this.shield.material.opacity = Math.max(0, this.shield.material.opacity - dt * 1.6);
    }

    // 相位护盾力场视觉（计时由相位护盾武器在 Weapons.update 内维护）
    if (this.phaseT > 0){
      this.phaseMesh.material.opacity = 0.12 + 0.24 * (this.phaseHp / Math.max(1, this.phaseMax));
      this.phaseMesh.scale.setScalar(1 + Math.sin(this.bob * 4) * 0.04);
    } else if (this.phaseMesh.material.opacity > 0){
      this.phaseMesh.material.opacity = Math.max(0, this.phaseMesh.material.opacity - dt * 1.5);
    }

    this.glow.material.opacity = 0.22 + Math.sin(this.bob * 3) * 0.06;
  },

  heal(n){
    const b = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n * Synergy.mods.heal);   // 医疗共鸣（全局治疗乘算）
    if (this.hp > b){
      FX.dmgText(this.x, this.z, this.hp - b, false, '#5dff9b');
      FX.ring(this.x, this.z, 0x5dff9b, 6, 0.45);
    }
  },

  takeDamage(n){
    if (Game.state !== 'PLAYING' || this.inv > 0) return;
    // 备用护盾层（护盾电池）：吸收一次撞击/受击，优先于相位护盾
    if (this.shieldLayer > 0){
      this.shieldLayer--;
      this.inv = Math.max(this.inv, 0.4);
      FX.ring(this.x, this.z, 0x6de0ff, 3, 0.25);
      Audio2.hit();
      return;
    }
    // 相位护盾（C②）：先于护甲吸收，吸满则免疫该次伤害
    if (this.phaseHp > 0){
      const a = Math.min(this.phaseHp, n);
      this.phaseHp -= a; n -= a;
      FX.ring(this.x, this.z, 0x38f0ff, 2.6, 0.2);
      if (this.phaseHp <= 0) this.phaseT = 0;
      if (n <= 0){ Audio2.hit(); return; }
    }
    const dmg = Math.max(1, n * (1 - Math.min(0.7, this.armor)));
    this.hp -= dmg;
    this.inv = CFG.player.invAfterHit;
    Audio2.hurt();
    World.shake(1.5, 0.3);
    FX.burst(this.x, this.z, 0xff3d7f, 12, 8, 1);
    FX.dmgText(this.x, this.z, dmg, false, '#ff6b95');
    HUD.flashHit();
    if (this.hp <= 0){ this.hp = 0; Game.onPlayerDead(this); }
  },

  // 环境危害（风暴/熔火/裂隙）持续掉血：绕过无敌帧，按 tick 结算，避免被 i-frame 完全免疫
  envDmg(n){
    if (Game.state !== 'PLAYING') return;
    this.hp -= n;
    HUD.flashHit();
    if (this.hp <= 0){ this.hp = 0; Game.onPlayerDead(this); }
  },

  // 腐蚀变异接触时调用：叠加中毒（持续掉血，走更新 tick 的死亡路径）
  applyPoison(dps, dur){
    this.poisonDps = Math.max(this.poisonDps, dps);
    this.poisonT = Math.max(this.poisonT, dur);
    FX.ring(this.x, this.z, 0x8dff5a, 2.4, 0.25);
  },
  };
}

const Player = makePlayer({ id: 1 });
const Player2 = makePlayer({ id: 2 });   // 双人：第二玩家实例（青色涂装，WASD 控制）

/* ============================ Bullets 弹药 ============================ */
/* 玩家弹 / 敌弹用 InstancedMesh（同构、量大，各 1 draw call）；导弹数量少且需
 * 独立朝向与尾焰，保留普通 Mesh 池。纯数据池不含 mesh，渲染靠 _flush 统一写矩阵。*/
const Bullets = {
  pInst: null, eInst: null, group: null,
  pPool: null, ePool: null, mPool: null,
  _m: new THREE.Matrix4(), _q: new THREE.Quaternion(), _e: new THREE.Euler(),
  _p: new THREE.Vector3(), _s: new THREE.Vector3(), _c: new THREE.Color(),

  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);

    // 玩家子弹：细长棱柱，InstancedMesh
    const pg = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 6);
    pg.rotateX(Math.PI / 2);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.pInst = new THREE.InstancedMesh(pg, pMat, 420);
    this.pInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pInst.frustumCulled = false; this.pInst.renderOrder = 8; this.pInst.count = 0;
    World.scene.add(this.pInst);

    // 敌弹：小球，InstancedMesh
    const eg = new THREE.SphereGeometry(0.3, 8, 6);
    const eMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
      opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.eInst = new THREE.InstancedMesh(eg, eMat, 300);
    this.eInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.eInst.frustumCulled = false; this.eInst.renderOrder = 8; this.eInst.count = 0;
    World.scene.add(this.eInst);

    // 纯数据池（无 mesh，渲染交给 InstancedMesh 统一写矩阵）
    this.pPool = Pool.create(420, () => ({ x:0, z:0, y:1, vx:0, vz:0, dmg:0, life:0,
      max:2, pierce:0, r:0.4, crit:false, target:null, turn:0, splash:0, hitSet:null,
      frost:false, color:0x9df6ff, long:1, sc:1 }));
    this.ePool = Pool.create(300, () => ({ x:0, z:0, y:0.9, vx:0, vz:0, dmg:0, life:0,
      max:4.5, r:0.42, pierce:0, color:0xff5c7a, sc:1 }));

    // 导弹：数量少、需独立朝向与尾焰，保留普通 Mesh 池
    const mg = new THREE.ConeGeometry(0.2, 0.9, 6); mg.rotateX(Math.PI / 2);
    this.mPool = Pool.create(120, () => {
      const m = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ color: 0xffcc33,
        transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; this.group.add(m);
      return { mesh: m, x:0, z:0, y:1.1, vx:0, vz:0, dmg:0, life:0, max:3.2,
        target:null, turn:6.2, splash:3.6, r:0.55, crit:false, pierce:0, color:0xffcc33, sc:1 };
    });
  },

  /** 玩家直线弹 */
  fire(x, z, dir, spd, dmg, opt){
    const o = this.pPool.get(); if (!o) return null;
    const q = opt || {};
    o.x = x; o.z = z; o.y = q.y || 1.0;
    o.vx = Math.sin(dir) * spd; o.vz = Math.cos(dir) * spd;
    o.dmg = dmg; o.life = 0; o.max = q.life || 1.5;
    o.pierce = q.pierce || 0; o.r = q.r || 0.45;
    o.crit = !!q.crit; o.splash = q.splash || 0;
    if (!o.hitSet) o.hitSet = new Set(); else o.hitSet.clear();
    o.sc = q.scale || 1; o.long = q.long || 1;
    o.frost = !!q.frost;
    o.color = q.color || (q.crit ? 0xffcc33 : 0x9df6ff);
    return o;
  },

  /** 追踪导弹 */
  missile(x, z, dmg, target, opt){
    const o = this.mPool.get(); if (!o) return null;
    const q = opt || {};
    o.x = x; o.z = z; o.y = 1.1;
    const a = q.dir != null ? q.dir : Math.random() * Util.TAU;
    const sp = q.spd || 15;
    o.vx = Math.sin(a) * sp; o.vz = Math.cos(a) * sp;
    o.dmg = dmg; o.life = 0; o.max = 3.2;
    o.target = target; o.turn = q.turn || 6.2;
    o.splash = q.splash || 3.6; o.r = 0.55;
    o.crit = !!q.crit; o.pierce = 0;
    o.sc = q.scale || 1; o.color = q.color || 0xffcc33;
    o.mesh.scale.setScalar(o.sc);
    o.mesh.material.color.setHex(o.color);
    o.mesh.position.set(o.x, o.y, o.z);
    o.mesh.visible = true;
    return o;
  },

  /** 敌方子弹 */
  enemyFire(x, z, dir, spd, dmg, opt){
    const o = this.ePool.get(); if (!o) return null;
    const q = opt || {};
    o.x = x; o.z = z; o.y = q.y || 0.9;
    o.vx = Math.sin(dir) * spd; o.vz = Math.cos(dir) * spd;
    o.dmg = dmg * (Game.hell ? CFG.hell.enemyWpnMul : 1);   // 地狱模式：敌弹伤害提升
    o.life = 0; o.max = q.life || 4.5;
    o.r = q.r || 0.42; o.pierce = 0;
    o.sc = q.scale || 1; o.color = q.color || 0xff5c7a;
    return o;
  },

  update(dt){
    /* ---- 玩家直线弹 ---- */
    this.pPool.each(b => {
      b.life += dt;
      if (b.life >= b.max) return true;
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.hypot(b.x, b.z) > CFG.arena + 12) return true;
      if (Math.random() < 0.9)
        FX.particle(b.x, b.y, b.z, b.color, { life: 0.22, s0: b.r * 0.85, s1: 0, drag: 4 });
      if (Asteroids.hitTest(b.x, b.z, b.r)){ FX.burst(b.x, b.z, 0x9fb0c0, 3, 3, b.y); return true; }
      const hits = Enemies.queryHit(b.x, b.z, b.r);
      for (const e of hits){
        if (b.hitSet.has(e._pi)) continue;
        b.hitSet.add(e._pi);
        if (b.frost){ e.frostLv = Math.min(3, (e.frostLv || 0) + 1); e.frostT = 0.5; }
        Enemies.damage(e, b.dmg, b.crit, b.x, b.z);
        if (b.slow) Enemies.slow(e, b.slow, b.slowK);   // 离子干扰炮：命中减速
        if (b.splash > 0) Enemies.splash(b.x, b.z, b.splash, b.dmg * 0.55, false);
        if (b.pierce-- <= 0){ FX.hitSpark(b.x, b.z, b.color, b.y); return true; }
      }
      if (Boss.active && Boss.hitTest(b.x, b.z, b.r)){
        Boss.damage(b.dmg, b.crit, b.x, b.z);
        if (b.pierce-- <= 0) return true;
      }
      return false;
    });

    /* ---- 导弹 ---- */
    this.mPool.each(b => {
      b.life += dt;
      if (b.life >= b.max){ this._boom(b); return true; }
      if (!b.target || !b.target.alive) b.target = Weapons.nearestTo(b.x, b.z, 999);
      if (b.target){
        const ta = Math.atan2(b.target.x - b.x, b.target.z - b.z);
        const ca = Math.atan2(b.vx, b.vz);
        const na = Util.angLerp(ca, ta, Math.min(1, b.turn * dt));
        const sp = Math.hypot(b.vx, b.vz) + 26 * dt;
        b.vx = Math.sin(na) * sp; b.vz = Math.cos(na) * sp;
      }
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.y = Math.atan2(b.vx, b.vz);
      if (Math.random() < 0.9)
        FX.particle(b.x, b.y, b.z, 0xffb24a, { life: 0.34, s0: 0.48, drag: 4 });
      if (Asteroids.hitTest(b.x, b.z, b.r)){ this._boom(b); return true; }
      const hits = Enemies.queryHit(b.x, b.z, b.r);
      if (hits.length){ this._boom(b); return true; }
      if (Boss.active && Boss.hitTest(b.x, b.z, b.r)){ this._boom(b); return true; }
      return false;
    });

    /* ---- 敌弹 ---- */
    this.ePool.each(b => {
      b.life += dt;
      if (b.life >= b.max) return true;
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.hypot(b.x, b.z) > CFG.arena + 10) return true;
      if (Math.random() < 0.85)
        FX.particle(b.x, b.y, b.z, b.color, { life: 0.2, s0: b.r * 0.75, s1: 0, drag: 3.5 });
      let hitP = null;
      for (const p of Game.alivePlayers()){
        if (Util.dist2(b.x, b.z, p.x, p.z) < (b.r + CFG.player.radius) ** 2){ hitP = p; break; }
      }
      if (hitP){
        hitP.takeDamage(b.dmg);
        FX.hitSpark(b.x, b.z, 0xff5c7a, b.y);
        return true;
      }
      const w = Wingmen.intercept(b.x, b.z, b.r);
      if (w){ FX.burst(b.x, b.z, 0x5dff9b, 6, 5, b.y); return true; }
      return false;
    });

    // 统一把活跃数据写入 InstancedMesh 矩阵（逐帧重写，关自动更新）
    this._flush(this.pInst, this.pPool, true);
    this._flush(this.eInst, this.ePool, false);
  },

  _flush(inst, pool, isPlayer){
    const list = pool.active, n = list.length;
    for (let i = 0; i < n; i++){
      const b = list[i];
      this._p.set(b.x, b.y, b.z);
      let yaw = 0, sx, sy, sz;
      if (isPlayer){ yaw = Math.atan2(b.vx, b.vz); sx = b.sc; sy = b.sc; sz = b.sc * (b.long || 1); }
      else { sx = b.sc; sy = b.sc; sz = b.sc; }
      this._q.setFromEuler(this._e.set(0, yaw, 0));
      this._s.set(sx, sy, sz);
      this._m.compose(this._p, this._q, this._s);
      inst.setMatrixAt(i, this._m);
      this._c.setHex(b.color); inst.setColorAt(i, this._c);
    }
    inst.count = n;
    if (n > 0){ inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true; }
  },

  _boom(b){
    b.mesh.visible = false;
    FX.explode(b.x, b.z, 0xff9a3d, 0.85);
    Audio2.hit();
    World.shake(0.35, 0.14);
    Enemies.splash(b.x, b.z, b.splash, b.dmg, b.crit);
    if (Boss.active && Boss.hitTest(b.x, b.z, b.splash)) Boss.damage(b.dmg, b.crit, b.x, b.z);
  },

  reset(){
    this.pPool.releaseAll(); this.ePool.releaseAll(); this.mPool.releaseAll();
    this.pInst.count = 0; this.eInst.count = 0;
  },
};
