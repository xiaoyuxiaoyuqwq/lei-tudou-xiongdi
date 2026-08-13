
/* ============================ Player 玩家 ============================ */
const Player = {
  x: 0, z: 0, vx: 0, vz: 0, yaw: 0,
  hp: 100, maxHp: 100,
  inv: 0,                       // 无敌帧
  dashT: 0, dashCd: 0, dashDX: 0, dashDZ: 0,
  group: null, shipG: null, thr: null, glow: null, shield: null,
  cfg: null, bob: 0,

  init(){
    this.cfg = SHIPS[Game.shipIdx || 0];
    this.group = new THREE.Group();
    this._buildShip();

    this.thr = Gfx.thruster(this.cfg.color, 0.20, -0.85, { opacity: 0.34, core: 0.55 });
    this.thr.position.y = 0.95;
    this.group.add(this.thr);

    this.glow = Gfx.glow(this.cfg.color, 1.8, 0.28);
    this.group.add(this.glow);

    // 受击/无敌时的护盾球
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 16, 12),
      new THREE.MeshBasicMaterial({ color: this.cfg.color, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.shield.position.y = 1.0;
    this.group.add(this.shield);

    World.scene.add(this.group);
  },

  /** 按当前 cfg 重建机身（换机型时调用）*/
  _buildShip(){
    if (this.shipG) this.group.remove(this.shipG);
    const built = Gfx.ship(this.cfg.model, this.cfg.color, 1.0);
    this.shipG = built.g; this.mats = built.mats;
    this.shipG.position.y = 0.95;
    this.group.add(this.shipG);
  },

  /** 切换机型（菜单选择后、开局前调用）*/
  setShip(idx){
    this.cfg = SHIPS[idx] || SHIPS[0];
    this._buildShip();
    if (this.thr)    this.thr.userData.cone.material.color.setHex(this.cfg.color);
    if (this.glow)   this.glow.material.color.setHex(this.cfg.color);
    if (this.shield) this.shield.material.color.setHex(this.cfg.color);
  },

  reset(){
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0; this.yaw = 0;
    this.maxHp = this.cfg.hp; this.hp = this.maxHp;
    this.inv = 0; this.dashT = 0; this.dashCd = 0; this.bob = 0;
    this.group.visible = true;
    this.group.position.set(0, 0, 0);
    this.shipG.rotation.y = 0;
    this.shield.material.opacity = 0;
  },

  get speed(){ return this.cfg.spd * (1 + Progress.p('speed') * 0.09); },
  get fireMul(){ return this.cfg.fire || 1; },
  get armor(){ return Progress.p('armor') * 0.06; },      // 每级 6% 减伤
  get pickR(){ return CFG.pickRadius * (1 + Progress.p('pick') * 0.34); },

  update(dt){
    /* --- 冲刺 --- */
    if (this.dashCd > 0) this.dashCd -= dt;
    if (Input.consumeDash() && this.dashCd <= 0 && (Input.ax || Input.az)){
      this.dashT = CFG.player.dashTime;
      this.dashCd = CFG.player.dashCd;
      this.dashDX = Input.ax; this.dashDZ = Input.az;
      this.inv = Math.max(this.inv, CFG.player.dashTime + 0.12);
      Audio2.dash();
      FX.ring(this.x, this.z, this.cfg.color, 5, 0.3);
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
      const tx = Input.ax * spd, tz = Input.az * spd;
      const acc = (Input.ax || Input.az) ? CFG.player.accel : CFG.player.drag;
      const k = 1 - Math.exp(-acc * dt);
      this.vx += (tx - this.vx) * k;
      this.vz += (tz - this.vz) * k;
    }

    this.x += this.vx * dt;
    this.z += this.vz * dt;
    if (Util.clampArena(this, CFG.player.radius)){ this.vx *= 0.4; this.vz *= 0.4; }

    /* --- 朝向：优先朝向索敌目标，否则朝移动方向 --- */
    const tgt = Weapons.currentTarget;
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

    this.glow.material.opacity = 0.22 + Math.sin(this.bob * 3) * 0.06;
  },

  heal(n){
    const b = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    if (this.hp > b){
      FX.dmgText(this.x, this.z, this.hp - b, false, '#5dff9b');
      FX.ring(this.x, this.z, 0x5dff9b, 6, 0.45);
    }
  },

  takeDamage(n){
    if (Game.state !== 'PLAYING' || this.inv > 0) return;
    const dmg = Math.max(1, n * (1 - Math.min(0.7, this.armor)));
    this.hp -= dmg;
    this.inv = CFG.player.invAfterHit;
    Audio2.hurt();
    World.shake(1.5, 0.3);
    FX.burst(this.x, this.z, 0xff3d7f, 12, 8, 1);
    FX.dmgText(this.x, this.z, dmg, false, '#ff6b95');
    HUD.flashHit();
    if (this.hp <= 0){ this.hp = 0; Game.over(false); }
  },
};

/* ============================ Bullets 弹药 ============================ */
const Bullets = {
  pPool: null, ePool: null, mPool: null, group: null,

  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);

    // 玩家子弹：细长棱柱，朝 +Z
    const pg = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 6);
    pg.rotateX(Math.PI / 2);
    this.pPool = Pool.create(420, () => this._mk(pg, 0x9df6ff));

    // 敌弹：小球
    const eg = new THREE.SphereGeometry(0.3, 8, 6);
    this.ePool = Pool.create(300, () => this._mk(eg, 0xff5c7a));

    // 导弹：锥体 + 尾迹
    const mg = new THREE.ConeGeometry(0.2, 0.9, 6);
    mg.rotateX(Math.PI / 2);
    this.mPool = Pool.create(120, () => this._mk(mg, 0xffcc33));
  },

  _mk(geo, color){
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
      depthWrite: false }));
    m.visible = false;
    this.group.add(m);
    return { mesh: m, x:0, z:0, y:1, vx:0, vz:0, dmg:0, life:0, max:2,
             pierce:0, r:0.4, crit:false, target:null, turn:0, splash:0, hitSet:null };
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
    const sc = q.scale || 1;
    o.mesh.scale.set(sc, sc, sc * (q.long || 1));
    o.mesh.material.color.setHex(q.color || (q.crit ? 0xffcc33 : 0x9df6ff));
    o.mesh.material.opacity = 1;
    o.mesh.position.set(o.x, o.y, o.z);
    o.mesh.rotation.set(0, dir, 0);
    o.mesh.visible = true;
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
    const sc = q.scale || 1;
    o.mesh.scale.setScalar(sc);
    o.mesh.material.color.setHex(q.color || 0xffcc33);
    o.mesh.material.opacity = 1;
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
    o.dmg = dmg; o.life = 0; o.max = q.life || 4.5;
    o.r = q.r || 0.42; o.pierce = 0;
    const sc = q.scale || 1;
    o.mesh.scale.setScalar(sc);
    o.mesh.material.color.setHex(q.color || 0xff5c7a);
    o.mesh.material.opacity = 1;
    o.mesh.position.set(o.x, o.y, o.z);
    o.mesh.visible = true;
    return o;
  },

  update(dt){
    /* ---- 玩家直线弹 ---- */
    this.pPool.each(b => {
      b.life += dt;
      if (b.life >= b.max){ b.mesh.visible = false; return true; }
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.hypot(b.x, b.z) > CFG.arena + 12){ b.mesh.visible = false; return true; }
      b.mesh.position.set(b.x, b.y, b.z);
      // 发光拖尾（能量弹拖一缕同色光尘，连续成丝，手感更脆）
      if (Math.random() < 0.9)
        FX.particle(b.x, b.y, b.z, b.mesh.material.color.getHex(),
          { life: 0.22, s0: b.r * 0.85, s1: 0, drag: 4 });

      if (Asteroids.hitTest(b.x, b.z, b.r)){   // 陨石阻挡玩家子弹
        FX.burst(b.x, b.z, 0x9fb0c0, 3, 3, b.y);
        b.mesh.visible = false; return true;
      }

      const hits = Enemies.queryHit(b.x, b.z, b.r);
      for (const e of hits){
        if (b.hitSet.has(e._pi)) continue;
        b.hitSet.add(e._pi);
        Enemies.damage(e, b.dmg, b.crit, b.x, b.z);
        if (b.splash > 0) Enemies.splash(b.x, b.z, b.splash, b.dmg * 0.55, false);
        if (b.pierce-- <= 0){
          FX.hitSpark(b.x, b.z, b.mesh.material.color.getHex(), b.y);
          b.mesh.visible = false;
          return true;
        }
      }
      // BOSS 命中
      if (Boss.active && Boss.hitTest(b.x, b.z, b.r)){
        Boss.damage(b.dmg, b.crit, b.x, b.z);
        if (b.pierce-- <= 0){ b.mesh.visible = false; return true; }
      }
      return false;
    });

    /* ---- 导弹 ---- */
    this.mPool.each(b => {
      b.life += dt;
      if (b.life >= b.max){ this._boom(b); return true; }
      // 目标失效则换目标
      if (!b.target || !b.target.alive) b.target = Weapons.nearestTo(b.x, b.z, 999);
      if (b.target){
        const ta = Math.atan2(b.target.x - b.x, b.target.z - b.z);
        const ca = Math.atan2(b.vx, b.vz);
        const na = Util.angLerp(ca, ta, Math.min(1, b.turn * dt));
        const sp = Math.hypot(b.vx, b.vz) + 26 * dt;         // 逐渐加速
        b.vx = Math.sin(na) * sp; b.vz = Math.cos(na) * sp;
      }
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);
      b.mesh.rotation.y = Math.atan2(b.vx, b.vz);
      if (Math.random() < 0.9)
        FX.particle(b.x, b.y, b.z, 0xffb24a, { life: 0.34, s0: 0.48, drag: 4 });   // 导弹炽热尾焰

      if (Asteroids.hitTest(b.x, b.z, b.r)){ this._boom(b); return true; }

      const hits = Enemies.queryHit(b.x, b.z, b.r);
      if (hits.length){ this._boom(b); return true; }
      if (Boss.active && Boss.hitTest(b.x, b.z, b.r)){ this._boom(b); return true; }
      return false;
    });

    /* ---- 敌弹 ---- */
    this.ePool.each(b => {
      b.life += dt;
      if (b.life >= b.max){ b.mesh.visible = false; return true; }
      b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.hypot(b.x, b.z) > CFG.arena + 10){ b.mesh.visible = false; return true; }
      b.mesh.position.set(b.x, b.y, b.z);
      // 敌弹拖尾（暗红/橙，视觉上更易预判走位）
      if (Math.random() < 0.85)
        FX.particle(b.x, b.y, b.z, b.mesh.material.color.getHex(),
          { life: 0.2, s0: b.r * 0.75, s1: 0, drag: 3.5 });
      b.mesh.rotation.y += dt * 6;

      if (Util.dist2(b.x, b.z, Player.x, Player.z) < (b.r + CFG.player.radius) ** 2){
        Player.takeDamage(b.dmg);
        FX.hitSpark(b.x, b.z, 0xff5c7a, b.y);
        b.mesh.visible = false;
        return true;
      }
      // 被守护僚机拦截
      const w = Wingmen.intercept(b.x, b.z, b.r);
      if (w){ FX.burst(b.x, b.z, 0x5dff9b, 6, 5, b.y); b.mesh.visible = false; return true; }
      return false;
    });
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
    this.pPool.each(b => { b.mesh.visible = false; return true; });
    this.ePool.each(b => { b.mesh.visible = false; return true; });
    this.mPool.each(b => { b.mesh.visible = false; return true; });
  },
};
