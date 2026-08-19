
/* ============================ Boss 深渊母舰 ============================ */
const Boss = {
  active: false, entering: false, phase: 1,
  hp: 0, maxHp: 8600,
  x: 0, z: -34, t: 0, yaw: 0,
  g: null, ud: null,
  atkCd: 0, spinCd: 0, summonCd: 0, chargeT: 0, chargeCd: 0,
  spiralCd: 0, spiralT: 0, spiralAng: 0, _spiralAcc: 0,
  sweepCd: 0, sweepT: 0, sweepWarn: 0, sweepAng: 0, _sweepBase: 0, _sweepSign: 1,
  _target: { x: 0, z: 0, r: 5.2, alive: true },
  r: 5.2,
  // 第二形态：随机决定（深渊母舰 NYX-Ω / 虚空巨像 VOID-Ξ），复用同一网格，配色/体量/攻击组不同
  variant: 'A', name: '深渊母舰 NYX-Ω', bossScale: 0.6,
  tint: 0xff3d7f, tint2: 0xffcc33, tintHex: '#ff3d7f', tint2Hex: '#ffcc33',
  novaMesh: null, novaCd: 0, novaT: 0, novaR: 0,

  init(){
    this.g = Gfx.boss();
    this.ud = this.g.userData;
    this.g.visible = false;
    World.scene.add(this.g);
    // 扫射激光（E 新增攻击）：细圆柱光束，沿 +Z，原点在底座
    const lg = new THREE.CylinderGeometry(0.7, 0.7, 1, 14, 1, true);
    lg.rotateX(Math.PI / 2); lg.translate(0, 0, 0.5);
    this.bossLaser = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({
      color: 0xff3d7f, transparent: true, opacity: 0,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.bossLaser.visible = false; World.scene.add(this.bossLaser);
    // 虚空巨像专属：扩张冲击环（闪避型 AoE）
    const ng = new THREE.TorusGeometry(1, 0.06, 6, 48); ng.rotateX(Math.PI / 2);
    this.novaMesh = new THREE.Mesh(ng, new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.novaMesh.visible = false; World.scene.add(this.novaMesh);
  },

  /** 按当前 variant 重新着色网格（init 时网格已建好，spawn 时才知形态） */
  _recolor(){
    if (!this.ud) return;
    const u = this.ud;
    u.hull.traverse(c => { if (c.isMesh && c.material.emissive) c.material.emissive.setHex(this.tint); });
    u.rings.forEach((r, i) => r.material.color.setHex(i % 2 ? this.tint2 : this.tint));
    u.halo.material.color.setHex(this.tint);
    u.outerHalo.material.color.setHex(this.tint);
    if (this.bossLaser) this.bossLaser.material.color.setHex(this.tint);
    u.core.traverse(c => { if (c.isMesh){ if (c.material.emissive) c.material.emissive.setHex(this.tint2); c.material.color.setHex(this.tint2); } });
  },

  spawn(round, variant){
    this.active = true; this.entering = true;
    this.phase = 1;
    this.round = round || 0;
    // 第二形态随机：A=深渊母舰 NYX-Ω（粉），B=虚空巨像 VOID-Ξ（青/紫，更大，专属震荡波）
    this.variant = variant || (Math.random() < 0.5 ? 'A' : 'B');
    if (this.variant === 'B'){
      this.tint = 0x49e0ff; this.tint2 = 0xb980ff; this.tintHex = '#49e0ff'; this.tint2Hex = '#b980ff';
      this.name = '虚空巨像 VOID-Ξ'; this.bossScale = 0.78; this.r = 6.2;
    } else {
      this.tint = 0xff3d7f; this.tint2 = 0xffcc33; this.tintHex = '#ff3d7f'; this.tint2Hex = '#ffcc33';
      this.name = '深渊母舰 NYX-Ω'; this.bossScale = 0.6; this.r = 5.2;
    }
    if (this.novaMesh) this.novaMesh.visible = false;
    this._recolor();
    this.maxHp = Math.round(8600 * (1 + 0.45 * this.round) * Game.hpMulAt(Game.wave || 1));   // 无尽轮次强化 + 同难度曲线
    this.hp = this.maxHp;
    const _sc = Game.spawnCenter(); this.x = 0; this.z = _sc.z - 46;   // 双人：相对参战玩家群中点生成
    this.t = 0; this.yaw = 0;
    this.atkCd = 2.4; this.spinCd = 5; this.summonCd = 6; this.chargeCd = 9; this.chargeT = 0;
    this.spiralCd = 6; this.spiralT = 0; this.spiralAng = 0; this._spiralAcc = 0;
    this.sweepCd = 11; this.sweepT = 0; this.sweepWarn = 0; this.sweepAng = 0; this._sweepBase = 0; this._sweepSign = 1;
    this.novaCd = 7.5; this.novaT = 0; this.novaR = 0;
    this.g.visible = true;
    this.g.position.set(this.x, 5.5, this.z);
    this.g.scale.setScalar(0.15);
    HUD.showBoss(true);
    HUD.toast(this.name, 'WARNING · 歼灭目标', this.tintHex, 2.6);
    Audio2.bossWarn();
    World.shake(2.2, 0.9);
    return this;
  },

  asTarget(){
    this._target.x = this.x; this._target.z = this.z;
    this._target.alive = this.active;
    this._target.r = this.r;
    this._target.isBoss = true;   // 让玩家武器把 BOSS 当成合法目标：命中时 Enemies.damage 据此委托给 Boss.damage（之前误当普通敌人 → SPEC[undefined].color 崩溃）
    return this._target;
  },

  hitTest(x, z, r){
    if (!this.active || this.entering) return false;
    const rr = r + this.r;
    return Util.dist2(x, z, this.x, this.z) <= rr * rr;
  },

  damage(n, crit, hx, hz){
    if (!this.active || this.entering) return;
    this.hp -= n * Synergy.mods.dmg;
    Game.dmgDealt += n;
    FX.dmgText(hx == null ? this.x : hx, hz == null ? this.z : hz, n, !!crit);
    if (Math.random() < 0.35) FX.burst(
      hx == null ? this.x : hx, hz == null ? this.z : hz, 0xffffff, 3, 4, 2);
    this.ud.core.traverse(c => { if (c.isMesh) c.material.color.setHex(0xffffff); });
    if (this.hp <= 0){ this.hp = 0; this.die(); }
  },

  die(){
    this.active = false;
    HUD.showBoss(false);
    Audio2.boom();
    World.shake(4.5, 1.4);
    // 连锁爆炸继续在结算面板后面播，不阻塞结算流程
    for (let i = 0; i < 10; i++){
      setTimeout(() => {
        if (!this.g) return;
        const a = Math.random() * Util.TAU, r = Util.rand(0, 8);
        FX.explode(this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, this.tint, 2.2);
        Audio2.boom();
      }, i * 90);
    }
    for (let i = 0; i < 26; i++)
      Loot.dropGem(this.x + Util.rand(-8, 8), this.z + Util.rand(-8, 8), 20);
    this.g.visible = false;
    if (this.bossLaser) this.bossLaser.visible = false;
    if (Game.endless){
      // 无尽模式：击破后进入更高难度的下一轮 BOSS，而非结束（修复 BOSS 链断裂）
      HUD.toast(this.name + ' 已歼灭', 'WARNING · 下一轮来袭', this.tintHex, 2.2);
      setTimeout(() => { if (Game.state === 'PLAYING') Game.nextBossRound(); }, 200);
    } else {
      setTimeout(() => { if (Game.state === 'PLAYING') Game.over(true); }, 200);
    }
  },

  update(dt){
    if (!this.active) return;
    this.t += dt;
    const tp = Game.nearestPlayer(this.x, this.z) || Game.players[0];   // 双人：所有攻击/碰撞锁定最近存活玩家

    /* ---- 进场演出：从远处缩放降落 ---- */
    if (this.entering){
      const k = Util.clamp(this.t / 2.6, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      this.g.scale.setScalar(this.bossScale + e * this.bossScale);
      this.g.position.set(
        Util.lerp(this.x, tp.x, e * 0.55),
        Util.lerp(14, 4.6, e),
        Util.lerp(tp.z - 46, tp.z - 24, e));
      this.z = this.g.position.z; this.x = this.g.position.x;
      this.g.rotation.y += dt * 3.4 * (1 - e * 0.7);
      if (k >= 1){
        this.entering = false;
        FX.ring(this.x, this.z, 0xff3d7f, 26, 0.8);
        World.shake(3, 0.7);
        Audio2.boom();
      }
      return;
    }

    /* ---- 阶段切换 ---- */
    if (this.phase === 1 && this.hp / this.maxHp <= 0.5){
      this.phase = 2;
      HUD.toast('阶段 II · 狂暴', this.name + ' 核心过载', this.tint2Hex, 2);
      Audio2.bossWarn();
      World.shake(2.6, 0.8);
      FX.ring(this.x, this.z, this.tint2, 30, 0.9);
      this.ud.hull.traverse(c => { if (c.isMesh && c.material.emissive) c.material.emissive.setHex(this.tint2); });
      this.atkCd = 0.6;
    }
    const P2 = this.phase === 2;

    /* ---- 移动：缓慢逼近玩家，保持 17 距离 ---- */
    if (this.chargeT > 0){
      this.chargeT -= dt;
      const a = this.yaw;
      this.x += Math.sin(a) * 34 * dt;
      this.z += Math.cos(a) * 34 * dt;
      FX.particle(this.x, 3, this.z, this.tint, { life: 0.4, s0: 1.6, s1: 0, drag: 3 });
      if (Util.dist2(this.x, this.z, tp.x, tp.z) < (this.r + CFG.player.radius) ** 2)
        tp.takeDamage(26);
    } else {
      const dx = tp.x - this.x, dz = tp.z - this.z;
      const d = Math.hypot(dx, dz) || 1;
      const want = P2 ? 14 : 18;
      const k = (d - want) / want;
      const sp = (P2 ? 9.5 : 6.5) * Util.clamp(k, -1, 1);
      this.x += dx / d * sp * dt;
      this.z += dz / d * sp * dt;
      // 侧向绕行
      this.x += -dz / d * (P2 ? 5 : 3) * dt;
      this.z +=  dx / d * (P2 ? 5 : 3) * dt;
      this.yaw = Math.atan2(dx, dz);
    }
    Util.clampArena(this, this.r + 2);

    /* ---- 攻击 ---- */
    this.atkCd -= dt; this.spinCd -= dt; this.summonCd -= dt; this.chargeCd -= dt;

    // 1) 环形弹幕
    if (this.atkCd <= 0){
      this.atkCd = P2 ? 1.5 : 2.5;
      const n = P2 ? 22 : 14;
      const off = this.t * 0.7;
      for (let i = 0; i < n; i++){
        const a = i / n * Util.TAU + off;
        Bullets.enemyFire(this.x + Math.sin(a) * this.r, this.z + Math.cos(a) * this.r,
          a, P2 ? 20 : 16, 11, { color: this.tint, scale: 1.15, life: 5 });
      }
      FX.ring(this.x, this.z, this.tint, this.r * 2.4, 0.35);
      Audio2.tone(90, 0.2, 'sawtooth', 0.1, 40);
    }

    // 2) 追踪散射
    if (this.spinCd <= 0){
      this.spinCd = P2 ? 3.0 : 4.6;
      const base = Math.atan2(tp.x - this.x, tp.z - this.z);
      const n = P2 ? 9 : 5;
      for (let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * 0.19;
        Bullets.enemyFire(this.x, this.z, a, 30, 13,
          { color: this.tint2, scale: 0.95, life: 4 });
      }
      FX.burst(this.x, this.z, 0xffcc33, 8, 6, 2);
    }

    // 3) 召唤护卫（仅深渊母舰 NYX-Ω 具备）
    if (this.variant === 'A' && this.summonCd <= 0){
      this.summonCd = P2 ? 6.5 : 9;
      const n = P2 ? 6 : 4;
      for (let i = 0; i < n; i++){
        const a = i / n * Util.TAU + Math.random();
        const kind = P2 ? Util.pick(['charger', 'orbiter', 'splitter']) : 'charger';
        Enemies.spawn(kind, this.x + Math.cos(a) * 9, this.z + Math.sin(a) * 9,
          1.6 + Game.wave * 0.14, 1.1, 1, false, Game.stageTint);
      }
      FX.ring(this.x, this.z, this.tint2, 13, 0.5);
    }

    // 4) P2 冲撞
    if (P2 && this.chargeCd <= 0 && this.chargeT <= 0){
      this.chargeCd = 8.5; this.chargeT = 0.85;
      this.yaw = Math.atan2(tp.x - this.x, tp.z - this.z);
      HUD.toast('突进！', '', this.tintHex, 0.7);
      World.shake(1.2, 0.3);
    }

    // 5) 螺旋弹幕（P1/P2 均触发）：多臂螺旋喷射，封锁走位
    if (this.spiralT > 0){
      this.spiralT -= dt;
      this.spiralAng += dt * (P2 ? 4.2 : 3.0);
      this._spiralAcc += dt;
      if (this._spiralAcc >= 0.12){
        this._spiralAcc = 0;
        const arms = P2 ? 3 : 2;
        for (let i = 0; i < arms; i++){
          const a = this.spiralAng + i / arms * Util.TAU;
          Bullets.enemyFire(this.x + Math.sin(a) * this.r, this.z + Math.cos(a) * this.r,
            a, P2 ? 18 : 15, 10, { color: this.tint2, scale: 1.0, life: 5 });
        }
      }
      if (this.spiralT <= 0) this.spiralCd = P2 ? 7 : 10;
    } else {
      this.spiralCd -= dt;
      if (this.spiralCd <= 0){ this.spiralT = P2 ? 3.2 : 2.6; this.spiralAng = 0; this._spiralAcc = 0; }
    }

    // 6) 扫射激光（仅深渊母舰 NYX-Ω · P2 限定）：先亮细光束预警 0.55s，再旋转横扫
    if (P2 && this.variant === 'A'){
      if (this.sweepWarn > 0){
        this.sweepWarn -= dt;
        this._sweepBase = Math.atan2(tp.x - this.x, tp.z - this.z);
        this._sweepSign = Math.random() < 0.5 ? 1 : -1;
        this.bossLaser.visible = true;
        this.bossLaser.position.set(this.x, 1.2, this.z);
        this.bossLaser.rotation.set(0, this._sweepBase, 0);
        this.bossLaser.scale.set(1, 1, 64);
        this.bossLaser.material.opacity = 0.12 + Math.sin(this.t * 30) * 0.07;   // 细预警光束，无伤
        if (this.sweepWarn <= 0){ this.sweepT = 2.4; this.bossLaser.visible = false; }
      } else if (this.sweepT > 0){
        this.sweepT -= dt;
        const prog = 1 - this.sweepT / 2.4;
        this.sweepAng = this._sweepBase + Math.sin(prog * Math.PI) * 0.9 * this._sweepSign;
        this.bossLaser.visible = true;
        this.bossLaser.position.set(this.x, 1.2, this.z);
        this.bossLaser.rotation.set(0, this.sweepAng, 0);
        this.bossLaser.scale.set(1, 1, 64);
        this.bossLaser.material.opacity = 0.45 + Math.sin(this.t * 22) * 0.2;
        const dx = tp.x - this.x, dz = tp.z - this.z;
        const pa = Math.atan2(dx, dz);
        let da = pa - this.sweepAng;
        while (da > Math.PI) da -= Util.TAU; while (da < -Math.PI) da += Util.TAU;
        const pd = Math.hypot(dx, dz);
        if (Math.abs(da) < 0.055 && pd < 64 && tp.inv <= 0){
          tp.takeDamage(15);
          FX.burst(tp.x, tp.z, this.tint, 4, 4, 1);
        }
        if (this.sweepT <= 0){ this.bossLaser.visible = false; this.sweepCd = 9; }
      } else {
        this.sweepCd -= dt;
        if (this.sweepCd <= 0){
          this.sweepWarn = 0.55;
          HUD.toast('激光扫射预警', '', this.tintHex, 0.7);
          Audio2.bossWarn();
        }
      }
    }

    // 7) 虚空巨像专属：扩张冲击环（闪避型 AoE，命中半径带内受伤）
    if (this.variant === 'B'){
      if (this.novaT > 0){
        this.novaT -= dt;
        const maxR = 17;
        this.novaR = (1 - this.novaT / 1.1) * maxR;
        if (this.novaMesh){
          this.novaMesh.visible = true;
          this.novaMesh.position.set(this.x, 1.0, this.z);
          this.novaMesh.scale.set(this.novaR, this.novaR, 1);
          this.novaMesh.material.color.setHex(this.tint);
          this.novaMesh.material.opacity = 0.55 * Util.clamp(this.novaT / 1.1, 0, 1);
        }
        const pd = Math.hypot(tp.x - this.x, tp.z - this.z);
        if (Math.abs(pd - this.novaR) < 1.7 && tp.inv <= 0){
          tp.takeDamage(16);
          FX.burst(tp.x, tp.z, this.tint, 4, 4, 1);
        }
      } else {
        this.novaCd -= dt;
        if (this.novaCd <= 0){
          this.novaCd = P2 ? 5.0 : 7.5;
          this.novaT = 1.1; this.novaR = 0;
          HUD.toast('虚空震荡', '', this.tintHex, 0.7);
          Audio2.bossWarn();
        }
      }
    }

    /* ---- 表现 ---- */
    const bob = Math.sin(this.t * 1.5) * 0.35;
    this.g.position.set(this.x, 4.6 + bob, this.z);
    this.g.rotation.y = this.yaw;
    const u = this.ud;
    u.hull.rotation.y += dt * (P2 ? 0.85 : 0.4);
    u.hull.rotation.x += dt * 0.12;
    u.rings.forEach((r, i) => {
      r.rotation.z += dt * (0.35 + i * 0.22) * (i % 2 ? -1 : 1) * (P2 ? 2.1 : 1);
    });
    const pulse = 1 + Math.sin(this.t * (P2 ? 9 : 4.5)) * 0.13;
    u.core.scale.setScalar(pulse);
    const coreCol = new THREE.Color(P2 ? this.tint2 : this.tint);
    u.core.traverse(c => { if (c.isMesh) c.material.color.lerp(coreCol, 0.09); });
    u.halo.material.opacity = 0.16 + Math.sin(this.t * 3) * 0.06;
    if (u.outerHalo){
      u.outerHalo.rotation.z += dt * (P2 ? 0.8 : 0.4);
      u.outerHalo.material.opacity = 0.4 + Math.sin(this.t * 2.4) * 0.16;
    }
    u.pods.forEach((p, i) => {
      const a = this.t * (P2 ? 0.9 : 0.5) + i / 3 * Util.TAU;
      const rad = 6.0;
      p.position.set(Math.cos(a) * rad, Math.sin(this.t * 1.3 + i) * 1.2, Math.sin(a) * rad);
    });
    u.turrets.forEach((t, i) => {
      t.position.y = 0.3 + Math.sin(this.t * 3 + i) * 0.22;
    });

    HUD.setBoss(this.hp / this.maxHp);
  },

  clear(){
    this.active = false; this.entering = false; this.phase = 1;
    this.hp = 0; this.chargeT = 0; this.novaT = 0;
    if (this.novaMesh) this.novaMesh.visible = false;
    if (this.g){
      this.g.visible = false;
      this.ud.hull.traverse(c => { if (c.isMesh && c.material.emissive) c.material.emissive.setHex(this.tint || CFG.colors.boss); });
    }
    if (this.bossLaser) this.bossLaser.visible = false;
    HUD.showBoss(false);
  },
};

/* ============================ Progress 成长 ============================ */
/* ============================ 标签共鸣（流派构筑系统） ============================ */
/* 每把武器在 W_INFO 上挂 1~2 个标签；同标签武器等级合计达 3/6/9/12 阶梯解锁全局增益。
   所有乘算集中在 Synergy.mods，由少数 choke point（Enemies.damage / Boss.damage /
   Player.heal / Player.speed / Player.armor / Weapons.rollCrit / critMul）消费，
   避免把乘算撒进每把武器。剩余 mods（ctrl/elem/vuln/projSpeed/fireRate/pierce/
   summonDmg/summonRate/dronePlus/onHitHeal）为后续武器/僚机/敌人阶段消费预留。 */
const Synergy = {
  TIERS: {
    heavy:   { name:'重装', color:'#ff9d5c', steps:[3,6,9,12],
               dmg:[0.08,0.18,0.30,0.40], moveSlow:[0,0.05,0.10,0.15], armor:[0.05,0.10,0.15,0.20] },
    precise: { name:'精密', color:'#7fd4ff', steps:[3,6,9,12],
               crit:[0.05,0.15,0.25,0.35], critDmg:[0,0.15,0.30,0.50], pierce:[0,0,0,1] },
    energy:  { name:'能量', color:'#c77dff', steps:[3,6,9,12],
               ctrl:[0.15,0.30,0.45,0.60], elem:[0,0.10,0.20,0.30], vuln:[0,0,0.25,0.50] },
    barrage: { name:'弹幕', color:'#ffd95c', steps:[3,6,9,12],
               projSpeed:[0.10,0.20,0.30,0.40], fireRate:[0,0.10,0.20,0.30], pierce:[0,0,1,1] },
    summon:  { name:'召唤', color:'#9dff9d', steps:[3,6,9,12],
               dmg:[0.15,0.30,0.45,0.60], rate:[0,0.10,0.20,0.30], drone:[0,0,1,1] },
    medical: { name:'医疗', color:'#5dff9b', steps:[3,6,9,12],
               heal:[0.25,0.60,1.00,1.50], onHit:[0,0,3,6] },
  },
  mods: { dmg:1, heal:1, moveSlow:0, armor:0, crit:0, critDmg:0,
          ctrl:0, elem:0, vuln:0, projSpeed:0, fireRate:1, pierce:0,
          summonDmg:1, summonRate:1, dronePlus:0, onHitHeal:0 },
  _lv: {},
  refresh(){
    const lv = {}; for (const k in this.TIERS) lv[k] = 0;
    for (const wk in Progress.weapons){
      const L = Progress.weapons[wk]; if (!L) continue;
      const tags = (Progress.W_INFO[wk] && Progress.W_INFO[wk].tags) || [];
      for (const t of tags) lv[t] = (lv[t] || 0) + L;
    }
    this._lv = lv;
    const m = this.mods;
    m.dmg = 1; m.heal = 1; m.moveSlow = 0; m.armor = 0; m.crit = 0; m.critDmg = 0;
    m.ctrl = 0; m.elem = 0; m.vuln = 0; m.projSpeed = 0; m.fireRate = 1; m.pierce = 0;
    m.summonDmg = 1; m.summonRate = 1; m.dronePlus = 0; m.onHitHeal = 0;
    for (const tag in this.TIERS){
      const T = this.TIERS[tag]; const total = lv[tag] || 0;
      let tier = 0; for (let i = 0; i < T.steps.length; i++) if (total >= T.steps[i]) tier = i + 1;
      if (!tier) continue;
      const a = tier - 1;
      if (tag === 'summon'){
        if (T.dmg)      m.summonDmg = 1 + T.dmg[a];
        if (T.rate)     m.summonRate = 1 + T.rate[a];
        if (T.drone)    m.dronePlus  = T.drone[a];
      } else {
        if (T.dmg)      m.dmg      = 1 + T.dmg[a];
        if (T.heal)     m.heal     = 1 + T.heal[a];
        if (T.moveSlow) m.moveSlow = T.moveSlow[a];
        if (T.armor)    m.armor    = T.armor[a];
        if (T.crit)     m.crit     = T.crit[a];
        if (T.critDmg)  m.critDmg  = T.critDmg[a];
        if (T.ctrl)     m.ctrl     = T.ctrl[a];
        if (T.elem)     m.elem     = T.elem[a];
        if (T.vuln)     m.vuln     = T.vuln[a];
        if (T.projSpeed)m.projSpeed= T.projSpeed[a];
        if (T.fireRate) m.fireRate = 1 + T.fireRate[a];
        if (T.pierce)   m.pierce   = T.pierce[a];
        if (T.onHit)    m.onHitHeal= T.onHit[a];
      }
    }
  },
  tierInfo(tag){
    const T = this.TIERS[tag]; if (!T) return null;
    const total = this._lv[tag] || 0; let tier = 0;
    for (let i = 0; i < T.steps.length; i++) if (total >= T.steps[i]) tier = i + 1;
    const next = tier < T.steps.length ? T.steps[tier] : null;
    return { name:T.name, color:T.color, total, tier, next };
  },
  activeList(){
    const out = [];
    for (const tag in this.TIERS){ const t = this.tierInfo(tag); if (t && t.tier > 0) out.push(t); }
    out.sort((a, b) => b.tier - a.tier);
    return out;
  },
};

const Progress = {
  _owner: null,          // 双人：本进度归属的玩家（P1=Player，P2=Player2），由 Game.start 装配
  level: 1, exp: 0, need: 5, pending: 0,
  weapons: {}, passives: {},
  cards: [],

  W_INFO: {
    cannon:  { name:'脉冲主炮', icon:'✦', desc:'向索敌方向连射能量弹', tags:['heavy','barrage'] },
    missile: { name:'追踪导弹', icon:'◈', desc:'自动追踪，命中爆炸溅射', tags:['heavy'] },
    laser:   { name:'相位激光', icon:'≡', desc:'瞬发贯穿光束，无视队列', tags:['precise'] },
    aura:    { name:'湮灭力场', icon:'◎', desc:'环绕自身持续灼烧并减速', tags:['energy'] },
    spread:  { name:'散射霰弹', icon:'❋', desc:'近距扇形霰弹覆盖', tags:['barrage'] },
    orbit:   { name:'轨道切割环', icon:'✺', desc:'环绕自身的旋转斩击环', tags:['heavy'] },
    chain:   { name:'等离子电弧', icon:'⚡', desc:'电弧在敌人间弹跳', tags:['energy'] },
    drone:   { name:'无人僚机', icon:'◢', desc:'召唤无人机环绕攻击', tags:['summon'] },
    nova:    { name:'湮灭新星', icon:'✷', desc:'自身为中心爆发冲击波', tags:['heavy'] },
    saw:     { name:'量子飞轮', icon:'❂', desc:'掷出旋转刃穿透回旋', tags:['heavy','precise'] },
    rail:    { name:'电磁轨道炮', icon:'⇶', desc:'蓄能贯穿重炮，一发撕穿全场', tags:['heavy','precise'] },
    flame:   { name:'等离子灼焰', icon:'🔥', desc:'前方扇形持续灼烧', tags:['energy'] },
    pulse:   { name:'重力脉冲', icon:'◉', desc:'扩散冲击波，横扫近身敌群', tags:['barrage'] },
    frost:   { name:'冷冻射线', icon:'❄', desc:'命中叠霜，冻结期受伤 ×1.5', tags:['energy'] },
    meteor:  { name:'轨道打击', icon:'☄', desc:'锁定敌群密集区，残骸坠落 AoE', tags:['heavy'] },
    swarm:   { name:'蜂群导弹', icon:'✺', desc:'微型追踪弹齐射，覆盖压制', tags:['barrage'] },
    storm:   { name:'离子风暴', icon:'🌩', desc:'密集区随机雷击，连锁天罚', tags:['energy'] },
    blackhole:{ name:'黑洞', icon:'●', desc:'生成引力井吸附并灼烧，到期坍缩爆发', tags:['energy'] },
    phase:    { name:'相位护盾', icon:'⛨', desc:'周期展开吸收伤害的相位力场', tags:['medical'] },
    photon:   { name:'光子跳弹', icon:'✦', desc:'命中后弹射至最近其他敌人', tags:['precise'] },
    tractor:  { name:'牵引光束', icon:'➰', desc:'以自身为中心的引力场聚敌灼烧', tags:['heavy'] },
    rotor:    { name:'旋转相阵', icon:'✺', desc:'环绕自身的相位节点接触杀伤', tags:['barrage'] },
    mine:     { name:'太空雷阵', icon:'✸', desc:'周围布设地雷，敌近即爆', tags:['barrage'] },
    nano:     { name:'纳米修复', icon:'✚', desc:'周期治疗，恢复结构强度', tags:['medical'] },
    radial:  { name:'径向脉冲', icon:'✺', desc:'周期向四周喷射环形弹幕', tags:['barrage'] },
    reflect: { name:'锋芒立场', icon:'⛨', desc:'反射敌弹并灼烧近身敌人', tags:['heavy'] },
    lance:   { name:'蓄能长矛', icon:'➤', desc:'蓄力后射出撕穿全场的重矛', tags:['precise','heavy'] },
    pulsar:  { name:'脉冲星炮', icon:'✦', desc:'蓄能射出贯穿脉冲束击退敌人', tags:['precise','energy'] },
    siege:   { name:'攻城轨道炮', icon:'⊕', desc:'蓄能轰击最远敌人，落点大爆破', tags:['heavy','precise'] },
    scatter: { name:'离子散射炮', icon:'✷', desc:'扇形喷射高速离子弹清场', tags:['barrage','energy'] },
    ion:     { name:'离子干扰炮', icon:'❂', desc:'三连离子弹命中减速敌人', tags:['precise','energy'] },
  },
  G_INFO: {
    striker:  { name:'突击僚机', icon:'▲', desc:'高频双联装，压制杂兵' },
    warden:   { name:'守护僚机', icon:'⬢', desc:'拦截敌方弹幕，贴身护卫' },
    howitzer: { name:'榴弹僚机', icon:'●', desc:'抛射高爆弹，大范围杀伤' },
    phantom:  { name:'幽灵刺客', icon:'◣', desc:'高伤穿透直射，绕背突袭' },
    medic:    { name:'医疗机',   icon:'✚', desc:'定期为玩家恢复生命值' },
    cruiser:  { name:'护卫舰',   icon:'⬣', desc:'双联重型能量弹，穿透压制' },
    interceptor:{ name:'拦截机', icon:'▲', desc:'超高射速三连点射' },
    sentinel: { name:'哨戒舰',   icon:'◈', desc:'稳定穿透能量弹支援' },
    spitfire: { name:'喷火僚机', icon:'▲', desc:'超高射速，点射压制' },
    bulwark:  { name:'壁垒僚机', icon:'⬢', desc:'重型能量弹，稳定输出' },
  },
  P_INFO: {
    speed: { name:'推进强化', icon:'»', desc:'移动速度提升',   fmt: l => '+' + (l * 9) + '% 移速' },
    rate:  { name:'超载弹链', icon:'⚡', desc:'全武器射速提升', fmt: l => '+' + (l * 9) + '% 射速' },
    crit:  { name:'精准校准', icon:'✧', desc:'暴击率与暴伤提升', fmt: l => (l * 7) + '% 暴击 / ×' + (2.1 + l * 0.05).toFixed(2) },
    pick:  { name:'磁力线圈', icon:'◉', desc:'经验拾取范围扩大', fmt: l => '+' + (l * 34) + '% 拾取' },
    hp:    { name:'装甲增幅', icon:'✚', desc:'最大生命提升并回复', fmt: l => '+' + (l * 22) + ' 最大生命' },
    armor: { name:'能量护盾', icon:'⛨', desc:'受到的伤害降低',   fmt: l => '-' + (l * 6) + '% 受伤' },
  },

  reset(){
    this.level = 1; this.exp = 0; this.pending = 0;
    this.need = this.calcNeed(1);
    // 起手武器：主炮永远有，再叠加所选飞机的初始武器（VS 风格）
    const ship = this._owner.cfg || SHIPS[0];
    this.weapons = { cannon: 1 };
    if (ship.startWeapon && ship.startWeapon !== 'cannon'){
      this.weapons[ship.startWeapon] = 1;
    }
    // 天赋：开局送 1 级对应被动
    this.passives = {};
    if (ship.talent){
      this.passives[ship.talent] = (this.passives[ship.talent] || 0) + 1;
    }
    this.cards = [];
    // 天赋若是 hp，重新计算最大生命并回满
    if (this.p('hp') > 0){
      this._owner.maxHp = this._owner.cfg.hp + this.p('hp') * 22;
      this._owner.hp = this._owner.maxHp;
    }
    Synergy.refresh();   // 起手武器/天赋确定后刷新共鸣
  },

  calcNeed(lv){ return Math.round(CFG.xpBase + CFG.xpStep * Math.pow(lv, CFG.xpPow)); },

  w(k){ return this.weapons[k] || 0; },
  p(k){ return this.passives[k] || 0; },

  gainExp(n){
    this.exp += n;
    let guard = 0;
    while (this.exp >= this.need && guard++ < 200){
      this.exp -= this.need;
      this.level++;
      this.pending++;
      this.need = this.calcNeed(this.level);
    }
    if (this.pending > 0) Game.requestLevelUp(this._owner);
  },

  /* ---- 生成 3 张候选卡 ---- */
  roll(){
    const opts = [];
    // 武器
    for (const k in this.W_INFO){
      const lv = this.w(k);
      if (lv >= 5) continue;
      const owned = lv > 0;
      // 已有的更容易再出现（滚雪球），未拥有的在武器数<4 时也有机会
      opts.push({ type:'weapon', key:k, lv, weight: owned ? 30 : (Object.keys(this.weapons).length < 4 ? 22 : 8) });
    }
    // 僚机
    for (const k in this.G_INFO){
      const c = Wingmen.count(k);
      if (c >= 3 || Wingmen.list.length >= 6) continue;
      opts.push({ type:'wing', key:k, lv:c, weight: 16 });
    }
    // 被动
    for (const k in this.P_INFO){
      const lv = this.p(k);
      if (lv >= 5) continue;
      let w = 20;
      if (k === 'hp' && this._owner.hp / this._owner.maxHp < 0.5) w = 34;   // 残血时更容易出防御
      if (k === 'armor' && this._owner.hp / this._owner.maxHp < 0.5) w = 30;
      opts.push({ type:'passive', key:k, lv, weight: w });
    }
    // 保底治疗
    if (this._owner.hp < this._owner.maxHp * 0.75)
      opts.push({ type:'heal', key:'heal', lv:0, weight: this._owner.hp / this._owner.maxHp < 0.35 ? 26 : 10 });

    // 突变卡：里程碑稀有，强力复合增益（LV.4 后小概率出现）
    if (this.level >= 4 && Math.random() < 0.16)
      opts.push({ type:'mutation', key:'mutation', lv:0, weight: 6 });

    // 加权抽 3 张不重复
    const picked = [];
    const pool = opts.slice();
    for (let n = 0; n < 3 && pool.length; n++){
      let tot = 0;
      for (const o of pool) tot += o.weight;
      let r = Math.random() * tot, idx = 0;
      for (let i = 0; i < pool.length; i++){
        r -= pool[i].weight;
        if (r <= 0){ idx = i; break; }
      }
      picked.push(pool.splice(idx, 1)[0]);
    }
    // 极端情况（全满级）兜底
    while (picked.length < 3) picked.push({ type:'heal', key:'heal', lv:0, weight:1 });
    this.cards = picked.map(c => this.describe(c));
    return this.cards;
  },

  /** 补齐 UI 需要的文案：名称 / 等级 / 效果差异 */
  describe(c){
    const o = Object.assign({}, c);
    if (c.type === 'weapon'){
      const I = this.W_INFO[c.key];
      const T = Weapons.TABLE[c.key];
      o.name = I.name; o.icon = I.icon; o.desc = I.desc;
      o.tag = c.lv === 0 ? '新武器' : '武器强化';
      o.lvTxt = c.lv === 0 ? '获得 · LV.1' : ('LV.' + c.lv + '  →  LV.' + (c.lv + 1));
      const nx = T[c.lv];
      if (c.key === 'aura')
        o.diff = '范围 ' + nx.r.toFixed(1) + ' · 伤害 ' + nx.dmg + ' · 减速 ' + Math.round(nx.slow * 100) + '%';
      else if (c.key === 'missile')
        o.diff = nx.n + ' 连发 · 伤害 ' + nx.dmg + ' · 溅射 ' + nx.splash.toFixed(1);
      else if (c.key === 'laser')
        o.diff = nx.n + ' 道光束 · 伤害 ' + nx.dmg;
      else if (c.key === 'spread')
        o.diff = nx.n + ' 发扇形 · 伤害 ' + nx.dmg;
      else if (c.key === 'orbit')
        o.diff = nx.n + ' 柄光刃 · 伤害 ' + nx.dmg + ' · 半径 ' + nx.r.toFixed(1);
      else if (c.key === 'chain')
        o.diff = nx.bounces + ' 次弹跳 · 伤害 ' + nx.dmg + ' · 范围 ' + nx.range;
      else if (c.key === 'drone')
        o.diff = nx.n + ' 架无人机 · 伤害 ' + nx.dmg + ' · 半径 ' + nx.r.toFixed(1);
      else if (c.key === 'nova')
        o.diff = '范围 ' + nx.r.toFixed(1) + ' · 伤害 ' + nx.dmg + ' · 周期 ' + nx.cd.toFixed(1) + 's';
      else if (c.key === 'saw')
        o.diff = nx.n + ' 柄飞锯 · 伤害 ' + nx.dmg + ' · 速度 ' + nx.spd;
      else if (c.key === 'rail')
        o.diff = '伤害 ' + nx.dmg + ' · 穿透 ' + (nx.pierce >= 999 ? '全场' : nx.pierce) + ' · 弹速 ' + nx.spd;
      else if (c.key === 'flame')
        o.diff = '范围 ' + nx.range + ' · 伤害 ' + nx.dmg + ' · 扇角 ' + Math.round(nx.arc * 57) + '°';
      else if (c.key === 'pulse')
        o.diff = '半径 ' + nx.r + ' · 伤害 ' + nx.dmg + ' · 周期 ' + nx.cd.toFixed(1) + 's';
      else if (c.key === 'blackhole')
        o.diff = '半径 ' + nx.r.toFixed(1) + ' · 秒伤 ' + nx.dps + ' · 持续 ' + nx.life.toFixed(1) + 's';
      else if (c.key === 'phase')
        o.diff = '护盾 ' + nx.hp + ' HP · 持续 ' + nx.dur.toFixed(1) + 's · 周期 ' + nx.cd.toFixed(1) + 's';
      else if (c.key === 'photon')
        o.diff = nx.n + ' 发 · 伤害 ' + nx.dmg + ' · 弹射 ' + nx.bounce + ' 次';
      else if (c.key === 'tractor')
        o.diff = '半径 ' + nx.r + ' · 秒伤 ' + nx.dps + ' · 牵引 ' + nx.pull;
      else if (c.key === 'rotor')
        o.diff = nx.n + ' 节点 · 伤害 ' + nx.dmg + ' · 半径 ' + nx.r.toFixed(1);
      else if (c.key === 'mine')
        o.diff = nx.n + ' 雷 · 伤害 ' + nx.dmg + ' · 半径 ' + nx.r.toFixed(1);
      else if (c.key === 'nano')
        o.diff = '治疗 +' + nx.hp + ' · 周期 ' + nx.cd.toFixed(1) + 's';
      else if (c.key === 'radial')
        o.diff = nx.n + ' 发环形弹幕 · 伤害 ' + nx.dmg + ' · 周期 ' + nx.cd.toFixed(2) + 's';
      else if (c.key === 'reflect')
        o.diff = '力场半径 ' + nx.r.toFixed(1) + ' · 灼烧 ' + nx.dmg + ' · 弹开敌弹';
      else if (c.key === 'lance')
        o.diff = '伤害 ' + nx.dmg + ' · 蓄力 ' + nx.charge.toFixed(2) + 's · 穿透 ' + (nx.pierce >= 999 ? '全场' : nx.pierce);
      else if (c.key === 'pulsar')
        o.diff = '伤害 ' + nx.dmg + ' · 蓄力 ' + nx.charge.toFixed(2) + 's · 穿透 全场';
      else if (c.key === 'siege')
        o.diff = '伤害 ' + nx.dmg + ' · 蓄力 ' + nx.charge.toFixed(2) + 's · 爆破 ' + nx.splash.toFixed(1);
      else if (c.key === 'scatter')
        o.diff = nx.n + ' 发扇形 · 伤害 ' + nx.dmg;
      else if (c.key === 'ion')
        o.diff = nx.n + ' 连发 · 伤害 ' + nx.dmg + ' · 命中减速 ' + Math.round((1 - nx.slowK) * 100) + '%';
      else
        o.diff = nx.n + ' 发 · 伤害 ' + nx.dmg + (nx.pierce ? ' · 穿透 ' + nx.pierce : '');
      // 附标签进度，供选卡显示共鸣阶梯
      const wt = this.W_INFO[c.key].tags || [];
      o.tags = wt.map(t => { const ti = Synergy.tierInfo(t);
        return { name: ti ? ti.name : t, color: ti ? ti.color : '#fff',
                 total: ti ? ti.total : 0, tier: ti ? ti.tier : 0, next: ti ? ti.next : null }; });
    } else if (c.type === 'wing'){
      const I = this.G_INFO[c.key];
      o.name = I.name; o.icon = I.icon; o.desc = I.desc;
      o.tag = '僚机';
      o.lvTxt = '编队 ' + c.lv + ' → ' + (c.lv + 1) + ' 架';
      const S = Wingmen.SPEC[c.key];
      o.diff = '伤害 ' + S.dmg + ' · 间隔 ' + S.cd.toFixed(2) + 's';
    } else if (c.type === 'passive'){
      const I = this.P_INFO[c.key];
      o.name = I.name; o.icon = I.icon; o.desc = I.desc;
      o.tag = '被动';
      o.lvTxt = 'LV.' + c.lv + '  →  LV.' + (c.lv + 1);
      o.diff = I.fmt(c.lv + 1);
    } else if (c.type === 'mutation'){
      o.name = '基因突变'; o.icon = '☢'; o.desc = '觉醒的复合强化';
      o.tag = '突变'; o.lvTxt = '一次性 · 强力';
      o.diff = '射速+18% · 暴击+14% · 移速+9% · 生命+22';
    } else {
      o.name = '紧急修复'; o.icon = '✚'; o.desc = '立即恢复全部结构强度';
      o.tag = '补给'; o.lvTxt = '一次性';
      o.diff = '生命回满 (' + Math.round(this._owner.maxHp - this._owner.hp) + ' HP)';
    }
    return o;
  },

  applyCard(c){
    if (!c) return;
    if (c.type === 'weapon'){
      this.weapons[c.key] = Math.min(5, this.w(c.key) + 1);
    } else if (c.type === 'wing'){
      Wingmen.add(c.key);
    } else if (c.type === 'passive'){
      const before = this.p(c.key);
      this.passives[c.key] = Math.min(5, before + 1);
      if (c.key === 'hp'){
        this._owner.maxHp = this._owner.cfg.hp + this.p('hp') * 22;
        this._owner.heal(22);
      }
    } else if (c.type === 'heal'){
      this._owner.heal(this._owner.maxHp);
    } else if (c.type === 'mutation'){
      this.passives.rate  = Math.min(5, this.p('rate') + 2);
      this.passives.crit  = Math.min(5, this.p('crit') + 2);
      this.passives.speed = Math.min(5, this.p('speed') + 1);
      this.passives.hp    = Math.min(5, this.p('hp') + 1);
      this._owner.maxHp = this._owner.cfg.hp + this.p('hp') * 22;
      this._owner.heal(22);
    }
    Synergy.refresh();   // 等级变化后刷新共鸣（影响下一帧伤害/治疗/移速）
    Audio2.levelup();
    HUD.renderGear();
  },
};

/* ============ 双人支持：按玩家实例化的进度状态 ============
   Progress 本体保留为 P1 的进度（所有现存 Progress.xxx 调用等价于 P1）。
   makeProgress(owner) 用 Object.create(Progress) 继承全部方法与静态信息表，
   仅用全新的可变状态字段（等级 / 经验 / 武器 / 被动 / 卡片）。*/
function makeProgress(owner){
  const pr = Object.create(Progress);
  pr._owner = owner;
  pr.level = 1; pr.exp = 0; pr.need = Progress.calcNeed(1); pr.pending = 0;
  pr.weapons = {}; pr.passives = {}; pr.cards = [];
  return pr;
}
const Progress2 = makeProgress(Player2);
// 装配：P1 进度归属 Player，P2 进度归属 Player2
Progress._owner = Player;
Player.progress = Progress;
Player2.progress = Progress2;
