
/* ============================ Weapons 武器系统 ============================ */
/* 全自动：玩家只负责走位，武器自己找目标开火（幸存者类核心手感）。*/
const Weapons = {
  currentTarget: null,
  cd: { cannon: 0, missile: 0, laser: 0, aura: 0, spread: 0, chain: 0, drone: 0, nova: 0, saw: 0, rail: 0, flame: 0, pulse: 0 },
  beams: [], auraMesh: null, auraT: 0,
  drones: [], droneGroup: null, droneT: 0,

  /* ---- 数值表：index = 等级-1，让每一级的提升都肉眼可见 ---- */
  TABLE: {
    cannon: [
      { n:1, dmg:12, cd:0.42, pierce:0, spread:0.00 },
      { n:2, dmg:14, cd:0.40, pierce:0, spread:0.00 },
      { n:3, dmg:16, cd:0.36, pierce:0, spread:0.17 },
      { n:3, dmg:21, cd:0.32, pierce:1, spread:0.20 },
      { n:5, dmg:26, cd:0.27, pierce:2, spread:0.26 },
    ],
    missile: [
      { n:1, dmg:26, cd:1.90, splash:3.2 },
      { n:1, dmg:34, cd:1.45, splash:3.7 },
      { n:2, dmg:38, cd:1.30, splash:4.2 },
      { n:3, dmg:44, cd:1.10, splash:4.7 },
      { n:4, dmg:54, cd:0.92, splash:5.4 },
    ],
    laser: [
      { n:1, dmg:20, cd:1.10, w:0.30 },
      { n:1, dmg:28, cd:0.92, w:0.38 },
      { n:2, dmg:32, cd:0.80, w:0.46 },
      { n:2, dmg:40, cd:0.66, w:0.56 },
      { n:3, dmg:48, cd:0.55, w:0.70 },
    ],
    aura: [
      { r:4.6, dmg:8,  cd:0.62, slow:0.10 },
      { r:5.6, dmg:12, cd:0.55, slow:0.14 },
      { r:6.6, dmg:16, cd:0.48, slow:0.19 },
      { r:7.8, dmg:21, cd:0.41, slow:0.24 },
      { r:9.2, dmg:27, cd:0.34, slow:0.30 },
    ],
    /* 散射霰弹：近距扇形覆盖，清杂兵神器 */
    spread: [
      { n:5, dmg:9,  cd:0.52, arc:0.95 },
      { n:6, dmg:11, cd:0.48, arc:1.05 },
      { n:7, dmg:13, cd:0.44, arc:1.15 },
      { n:8, dmg:15, cd:0.40, arc:1.28 },
      { n:9, dmg:18, cd:0.36, arc:1.40 },
    ],
    /* 环绕光刃：环绕自身的旋转斩击，持续近身输出 */
    orbit: [
      { n:2, dmg:14, cd:0.5, r:3.4, spin:2.2 },
      { n:3, dmg:18, cd:0.46, r:3.8, spin:2.4 },
      { n:3, dmg:22, cd:0.42, r:4.2, spin:2.6 },
      { n:4, dmg:26, cd:0.38, r:4.6, spin:2.8 },
      { n:5, dmg:30, cd:0.34, r:5.0, spin:3.0 },
    ],
    /* 连锁闪电：在敌人之间弹跳的电弧（VS 经典） */
    chain: [
      { bounces:2, dmg:14, cd:1.40, range:14 },
      { bounces:3, dmg:18, cd:1.25, range:16 },
      { bounces:4, dmg:22, cd:1.10, range:18 },
      { bounces:5, dmg:28, cd:0.95, range:20 },
      { bounces:6, dmg:34, cd:0.82, range:22 },
    ],
    /* 无人僚机：召唤若干无人机环绕玩家自动开火 */
    drone: [
      { n:1, dmg:9,  cd:1.40, r:5.0 },
      { n:2, dmg:11, cd:1.25, r:5.4 },
      { n:3, dmg:13, cd:1.10, r:5.8 },
      { n:4, dmg:16, cd:0.95, r:6.2 },
      { n:5, dmg:20, cd:0.80, r:6.6 },
    ],
    /* 湮灭新星：周期性以自身为中心爆发冲击波，清场型 AoE（区别于持久力场/定点链电） */
    nova: [
      { r:6.0,  dmg:18, cd:2.4 },
      { r:7.0,  dmg:24, cd:2.2 },
      { r:8.0,  dmg:30, cd:2.0 },
      { r:9.5,  dmg:38, cd:1.8 },
      { r:11.0, dmg:48, cd:1.6 },
    ],
    /* 回旋飞锯：掷出旋转刃沿瞄准方向飞出，穿透一切后回旋归位（复用真 3D 光刃模型） */
    saw: [
      { n:1, dmg:16, cd:1.10, spd:18, out:0.9  },
      { n:1, dmg:20, cd:1.00, spd:20, out:0.95 },
      { n:2, dmg:24, cd:0.95, spd:21, out:1.0  },
      { n:2, dmg:28, cd:0.85, spd:23, out:1.05 },
      { n:3, dmg:34, cd:0.78, spd:25, out:1.10 },
    ],
    /* 电磁轨道炮：蓄能后射出贯穿重炮，一发撕穿全场（区别于连射主炮 / 多目标激光） */
    rail: [
      { dmg:40,  cd:1.90, spd:90,  pierce:999 },
      { dmg:52,  cd:1.70, spd:95,  pierce:999 },
      { dmg:66,  cd:1.50, spd:100, pierce:999 },
      { dmg:82,  cd:1.30, spd:108, pierce:999 },
      { dmg:100, cd:1.10, spd:116, pierce:999 },
    ],
    /* 烈焰喷射：朝索敌方向喷出一束扇形火焰，持续灼烧锥内敌人 */
    flame: [
      { dmg:7,  cd:0.30, range:9,  arc:0.60 },
      { dmg:9,  cd:0.28, range:10, arc:0.70 },
      { dmg:11, cd:0.26, range:11, arc:0.80 },
      { dmg:13, cd:0.24, range:12, arc:0.90 },
      { dmg:16, cd:0.22, range:13, arc:1.00 },
    ],
    /* 声波脉冲：以自身为中心扩散的冲击环，像涟漪般横扫近身敌群 */
    pulse: [
      { dmg:14, cd:1.6, r:7  },
      { dmg:18, cd:1.5, r:8  },
      { dmg:23, cd:1.4, r:9  },
      { dmg:29, cd:1.3, r:10 },
      { dmg:36, cd:1.2, r:11 },
    ],
  },

  init(){
    this.beamGroup = new THREE.Group();
    World.scene.add(this.beamGroup);

    // 力场光环（贴地 + 竖直柱面双层）
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xb980ff, transparent: true, opacity: 0.34,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.1;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.5, 40, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x8f5cff, transparent: true, opacity: 0.12,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    cyl.position.y = 0.75;
    g.add(disc, cyl);
    g.visible = false;
    this.auraMesh = g; this.auraDisc = disc; this.auraCyl = cyl;
    World.scene.add(g);

    // 激光束池：外鞘(青/半透) + 内芯(白/亮) 双层圆柱，呈现"相位激光"发光质感
    const bg = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
    bg.rotateX(Math.PI / 2);           // 沿 +Z
    bg.translate(0, 0, 0.5);           // 原点在起点
    const bgCore = new THREE.CylinderGeometry(0.42, 0.42, 1, 8, 1, true);
    bgCore.rotateX(Math.PI / 2); bgCore.translate(0, 0, 0.5);
    for (let i = 0; i < 8; i++){
      const outer = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({
        color: 0x9df6ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const core = new THREE.Mesh(bgCore, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      const grp = new THREE.Group(); grp.add(outer, core); grp.visible = false;
      this.beamGroup.add(grp);
      this.beams.push({ mesh: grp, outer, core, life: 0 });
    }

    // 链式闪电折电池（固定 11 点 Line，渲染时实时抖动成锯齿电光）
    this.boltGroup = new THREE.Group();
    World.scene.add(this.boltGroup);
    this.bolts = [];
    for (let i = 0; i < 8; i++){
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(11 * 3), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      line.visible = false; line.frustumCulled = false;
      this.boltGroup.add(line);
      this.bolts.push({ line, life: 0 });
    }

    // 环绕光刃（最多 5 柄，按等级显隐）：真 3D 双刃模型 + 切割拖尾残影
    this.bladeGroup = new THREE.Group();
    World.scene.add(this.bladeGroup);
    this.blades = [];
    for (let i = 0; i < 5; i++){
      const m = Gfx.blade(0x8ff0ff);
      const tr = Gfx.blade(0x8ff0ff);
      m.visible = false; tr.visible = false;
      this.bladeGroup.add(m, tr);
      this.blades.push({ mesh: m, trail: tr, cd: 0 });
    }
    this.orbitT = 0;

    // 无人机（最多 5 架，按等级显隐）：真 3D 侦察无人机，环绕玩家自动攻击
    this.droneGroup = new THREE.Group();
    World.scene.add(this.droneGroup);
    this.drones = [];
    for (let i = 0; i < 5; i++){
      const g = Gfx.drone(0xffcc33, 2.0);
      g.visible = false;
      this.droneGroup.add(g);
      this.drones.push({ mesh: g, a: 0, cd: 0, r: 5.0, px: Player.x, pz: Player.z, recoil: 0 });
    }
    this.droneT = 0;

    // 回旋飞锯（最多 5 柄，按等级投掷）：真 3D 双刃 + 旋转金色锯盘残影
    this.sawGroup = new THREE.Group();
    World.scene.add(this.sawGroup);
    this.saws = [];
    for (let i = 0; i < 5; i++){
      const m = Gfx.blade(0xffd24a);
      const disc = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.72, 22),
        new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0,
          side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      disc.rotation.x = -Math.PI / 2;
      m.visible = false; disc.visible = false;
      this.sawGroup.add(m, disc);
      this.saws.push({ mesh: m, disc, active: false, x: 0, z: 0, vx: 0, vz: 0,
        t: 0, life: 0, out: 1, dmg: 0, spin: 0, hits: null, bossHit: false, returning: false });
    }

    // 新星冲击圈池（纯 FX，无需常驻网格）
    this.novaT = 0;
    this.pulses = [];          // 声波脉冲：扩散冲击环（自定义薄壳命中）
  },

  reset(){
    this.currentTarget = null;
    for (const k in this.cd) this.cd[k] = 0;
    this.auraMesh.visible = false;
    this.auraT = 0;
    for (const b of this.beams){ b.life = 0; b.mesh.visible = false; }
    if (this.blades) for (const bl of this.blades){ bl.cd = 0; bl.mesh.visible = false; if (bl.trail) bl.trail.visible = false; }
    this.orbitT = 0;
    if (this.drones) for (const d of this.drones){ d.cd = 0; d.mesh.visible = false; }
    this.droneT = 0;
    if (this.saws) for (const s of this.saws){ s.active = false; s.mesh.visible = false; if (s.disc) s.disc.visible = false; }
    if (this.bolts) for (const b of this.bolts){ b.life = 0; b.line.visible = false; }
    this.novaT = 0;
    if (this.pulses) this.pulses.length = 0;
  },

  /* ---- 索敌：优先 BOSS，其次最近的敌人 ---- */
  nearestTo(x, z, maxR){
    let best = null, bd = maxR * maxR;
    const list = Enemies.pool.active;
    for (let i = 0; i < list.length; i++){
      const e = list[i];
      const d = Util.dist2(x, z, e.x, e.z);
      if (d < bd){ bd = d; best = e; }
    }
    return best;
  },

  acquire(){
    if (Boss.active && !Boss.entering){
      const d = Math.hypot(Boss.x - Player.x, Boss.z - Player.z);
      if (d < 54){ this.currentTarget = Boss.asTarget(); return; }
    }
    const t = this.nearestTo(Player.x, Player.z, 46);
    this.currentTarget = t;
  },

  rateMul(){ return 1 / (1 + Progress.p('rate') * 0.09); },
  rollCrit(){ return Math.random() < Math.min(0.9, Progress.p('crit') * 0.07 + Synergy.mods.crit); },
  critMul(){ return 2.1 + Progress.p('crit') * 0.05 + Synergy.mods.critDmg; },

  /** 链式闪电：找 (x,z) 附近最近的存活敌人，排除 prev */
  _chainNext(x, z, range, prev){
    const list = Enemies.pool.active;
    let best = null, bd = range * range;
    for (let i = 0; i < list.length; i++){
      const e = list[i];
      if (!e.alive || e === prev) continue;
      const d = Util.dist2(x, z, e.x, e.z);
      if (d < bd){ bd = d; best = e; }
    }
    return best;
  },

  /** 链式闪电：用折线电弧画出 p1→p2 的锯齿电光（亮白核心 + 节点电火花） */
  _chainBeam(p1, p2){
    const b = this.bolts.find(x => x.life <= 0);
    if (!b) return;
    const dx = p2.x - p1.x, dz = p2.z - p1.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) return;
    const nx = -dz / len, nz = dx / len;            // 垂直方向（用于抖动）
    const pos = b.line.geometry.attributes.position.array;
    const N = 10;
    for (let i = 0; i <= N; i++){
      const t = i / N;
      let ox = 0, oy = 0, oz = 0;
      if (i > 0 && i < N){
        const amp = Math.sin(t * Math.PI) * (0.5 + Math.random() * 0.6);
        const sgn = Math.random() < 0.5 ? -1 : 1;
        ox = nx * amp * sgn; oz = nz * amp * sgn;
        oy = Math.sin(t * Math.PI) * (Math.random() - 0.5) * 0.4;
      }
      pos[i*3]   = p1.x + dx * t + ox;
      pos[i*3+1] = 1.1 + oy;
      pos[i*3+2] = p1.z + dz * t + oz;
    }
    b.line.geometry.attributes.position.needsUpdate = true;
    b.line.visible = true;
    b.life = 1;
    FX.burst(p2.x, p2.z, 0x9df6ff, 3, 4, 1.1);      // 节点电火花
  },

  update(dt){
    this.acquire();
    const T = this.currentTarget;
    const rm = this.rateMul() / (Player.fireMul || 1);

    /* ---------- 主炮 ---------- */
    const cl = Progress.w('cannon');
    if (cl > 0){
      this.cd.cannon -= dt;
      if (this.cd.cannon <= 0 && T){
        const S = this.TABLE.cannon[cl - 1];
        this.cd.cannon = S.cd * rm;
        const base = Math.atan2(T.x - Player.x, T.z - Player.z);
        for (let i = 0; i < S.n; i++){
          const off = (i - (S.n - 1) / 2) * S.spread;
          const crit = this.rollCrit();
          const dmg = S.dmg * (crit ? this.critMul() : 1);
          // 枪口在机头两侧
          const side = ((i % 2) ? 1 : -1) * 0.55;
          const px = Player.x + Math.cos(base) * side + Math.sin(base) * 1.2;
          const pz = Player.z - Math.sin(base) * side + Math.cos(base) * 1.2;
          Bullets.fire(px, pz, base + off, 62, dmg, {
            pierce: S.pierce, crit, long: 1.3,
            color: crit ? 0xffcc33 : 0x9df6ff, life: 1.3 });
        }
        const mx = Player.x + Math.sin(base) * 1.5, mz = Player.z + Math.cos(base) * 1.5;
        FX.ring(mx, mz, 0x9df6ff, 2.2, 0.16);          // 脉冲枪口闪光
        FX.burst(mx, mz, 0x9df6ff, 5, 3.4, 1.0);
        Audio2.cannonPulse();
      }
    }

    /* ---------- 追踪导弹 ---------- */
    const ml = Progress.w('missile');
    if (ml > 0){
      this.cd.missile -= dt;
      if (this.cd.missile <= 0 && T){
        const S = this.TABLE.missile[ml - 1];
        this.cd.missile = S.cd * rm;
        for (let i = 0; i < S.n; i++){
          const crit = this.rollCrit();
          const a = Player.yaw + Math.PI + (i - (S.n - 1) / 2) * 0.7 + Util.rand(-0.15, 0.15);
          Bullets.missile(Player.x + Math.sin(a) * 0.8, Player.z + Math.cos(a) * 0.8,
            S.dmg * (crit ? this.critMul() : 1),
            (i === 0 ? T : this.nearestTo(Player.x, Player.z, 46)) || T,
            { dir: a, splash: S.splash, crit, spd: 12, scale: 1 + ml * 0.06 });
        }
        FX.ring(Player.x, Player.z, 0xffb24a, 2.6, 0.2);   // 导弹发射闪光
        Audio2.missile();
      }
    }

    /* ---------- 相位激光 ---------- */
    const ll = Progress.w('laser');
    if (ll > 0){
      this.cd.laser -= dt;
      if (this.cd.laser <= 0 && T){
        const S = this.TABLE.laser[ll - 1];
        this.cd.laser = S.cd * rm;
        // 取最近的 n 个目标各来一发贯穿光束
        const targets = this.pickTargets(S.n);
        for (const tg of targets) this.beam(tg, S, ll);
        Audio2.laser();
      }
    }

    /* ---------- 湮灭力场 ---------- */
    const al = Progress.w('aura');
    if (al > 0){
      const S = this.TABLE.aura[al - 1];
      this.auraMesh.visible = true;
      this.auraT += dt;
      const pulse = 1 + Math.sin(this.auraT * 4.2) * 0.035;
      this.auraMesh.position.set(Player.x, 0, Player.z);
      this.auraDisc.scale.setScalar(S.r * pulse);
      this.auraCyl.scale.set(S.r * pulse, 1, S.r * pulse);
      this.auraDisc.rotation.z += dt * 0.7;
      this.auraCyl.material.opacity = 0.10 + Math.sin(this.auraT * 8) * 0.06;   // 力场微闪
      this.cd.aura -= dt;
      if (this.cd.aura <= 0){
        this.cd.aura = S.cd * rm;
        const hits = Enemies.queryHit(Player.x, Player.z, S.r);
        for (const e of hits){
          const crit = this.rollCrit();
          Enemies.damage(e, S.dmg * (crit ? this.critMul() : 1), crit, e.x, e.z);
          e.slowT = 0.6; e.slowK = S.slow;
        }
        if (hits.length){
          FX.ring(Player.x, Player.z, 0xb980ff, S.r * 1.05, 0.3);
          // 力场内缘向心电弧，强化"湮灭力场"观感
          for (let k = 0; k < 7; k++){
            const a = Math.random() * Util.TAU;
            FX.particle(Player.x + Math.cos(a) * S.r, 1.0, Player.z + Math.sin(a) * S.r,
              0xb980ff, { life: 0.3, s0: 0.5, s1: 0.1, drag: 2,
                vx: -Math.cos(a) * 5, vz: -Math.sin(a) * 5 });
          }
        }
        if (Boss.active && Boss.hitTest(Player.x, Player.z, S.r))
          Boss.damage(S.dmg * 1.2, false, Boss.x, Boss.z);
      }
      // 力场边缘持续电弧微光
      if (Math.random() < 0.35){
        const a = Math.random() * Util.TAU;
        FX.particle(Player.x + Math.cos(a) * S.r, 1.0, Player.z + Math.sin(a) * S.r,
          0xb980ff, { life: 0.3, s0: 0.4, s1: 0, drag: 3 });
      }
    } else {
      this.auraMesh.visible = false;
    }

    /* ---------- 散射霰弹 ---------- */
    const sl = Progress.w('spread');
    if (sl > 0 && T){
      this.cd.spread -= dt;
      if (this.cd.spread <= 0){
        const S = this.TABLE.spread[sl - 1];
        this.cd.spread = S.cd * rm;
        const base = Math.atan2(T.x - Player.x, T.z - Player.z);
        const crit = this.rollCrit();
        for (let i = 0; i < S.n; i++){
          const off = (i - (S.n - 1) / 2) / Math.max(1, S.n - 1) * S.arc;
          Bullets.fire(Player.x + Math.sin(base) * 1.1, Player.z + Math.cos(base) * 1.1,
            base + off, 54, S.dmg * (crit ? this.critMul() : 1),
            { crit: crit && i === (S.n >> 1), y: 1.0, color: 0xe7ffb0, scale: 0.7, life: 0.7 });
        }
        const sx = Player.x + Math.sin(base) * 1.4, sz = Player.z + Math.cos(base) * 1.4;
        FX.burst(sx, sz, 0xe7ffb0, 9, 3.8, 1);          // 霰弹枪口爆闪
        FX.ring(sx, sz, 0xe7ffb0, 2.6, 0.16);
        Audio2.spreadShot();
      }
    }

    /* ---------- 环绕光刃 ---------- */
    const ol = Progress.w('orbit');
    this.orbitT += dt;
    if (ol > 0){
      const S = this.TABLE.orbit[ol - 1];
      const pulse = Math.sin(this.orbitT * 6);
      for (let i = 0; i < this.blades.length; i++){
        const bl = this.blades[i];
        if (i < S.n){
          bl.mesh.visible = true;
          const a = this.orbitT * S.spin + i / S.n * Util.TAU;
          const bx = Player.x + Math.cos(a) * S.r;
          const bz = Player.z + Math.sin(a) * S.r;
          bl.mesh.position.set(bx, 1.0, bz);
          bl.mesh.rotation.set(0, a, 0);
          bl.mesh.material.opacity = 0.7 + pulse * 0.25;
          // 切割拖尾：沿切线后方一柄半透明刃影，扫出刀光弧
          const ta = a + Math.PI / 2;
          const trl = 1.0;
          bl.trail.visible = true;
          bl.trail.position.set(bx - Math.cos(ta) * trl, 1.0, bz - Math.sin(ta) * trl);
          bl.trail.rotation.set(0, a, 0);
          bl.trail.material.opacity = 0.28 + pulse * 0.1;
          bl.cd -= dt;
          if (bl.cd <= 0){
            const hits = Enemies.queryHit(bx, bz, 1.2);
            if (hits.length){
              bl.cd = 0.18;
              const crit = this.rollCrit();
              for (const e of hits){
                Enemies.damage(e, S.dmg * (crit ? this.critMul() : 1), crit, e.x, e.z);
                FX.hitSpark(e.x, e.z, 0x8ff0ff, 1.0);
              }
            }
          }
        } else { bl.mesh.visible = false; if (bl.trail) bl.trail.visible = false; }
      }
    } else {
      for (const bl of this.blades){ bl.mesh.visible = false; if (bl.trail) bl.trail.visible = false; }
    }

    /* ---------- 连锁闪电 ---------- */
    const chl = Progress.w('chain');
    if (chl > 0){
      this.cd.chain -= dt;
      if (this.cd.chain <= 0 && T){
        const S = this.TABLE.chain[chl - 1];
        this.cd.chain = S.cd * rm;
        const pts = [{x: Player.x, z: Player.z}];
        let cur = T, prev = null;
        for (let i = 0; i < S.bounces; i++){
          if (!cur || !cur.alive) break;
          const crit = this.rollCrit();
          const dmg = S.dmg * (crit ? this.critMul() : 1);
          Enemies.damage(cur, dmg, crit, cur.x, cur.z);
          pts.push({x: cur.x, z: cur.z});
          prev = cur;
          cur = this._chainNext(cur.x, cur.z, S.range, prev);
        }
        for (let i = 1; i < pts.length; i++) this._chainBeam(pts[i - 1], pts[i]);
        if (pts.length > 1){ Audio2.chainZap(); FX.ring(Player.x, Player.z, 0x9df6ff, 4.2, 0.28); }
      }
    }

    /* ---------- 无人僚机 ---------- */
    const dl = Progress.w('drone');
    this.droneT += dt;
    if (dl > 0){
      const S = this.TABLE.drone[dl - 1];
      const list = Enemies.pool.active;
      for (let i = 0; i < this.drones.length; i++){
        const d = this.drones[i];
        if (i < S.n){
          d.a = this.droneT * 1.4 + i / S.n * Util.TAU;
          // 编队：基础环 + 相位游走（半径轻微呼吸，避免死板等距绕圈）
          const wob = Math.sin(this.droneT * 0.8 + i * 2.1) * 0.7;
          const rad = S.r + wob;
          const tx = Player.x + Math.cos(d.a) * rad;
          const tz = Player.z + Math.sin(d.a) * rad;
          // 惯性跟随：朝目标位平滑插值（玩家急转时无人机甩尾跟进，更灵动）
          const k = 1 - Math.exp(-8 * dt);
          d.px += (tx - d.px) * k;
          d.pz += (tz - d.pz) * k;
          const dx = d.px, dz = d.pz;
          const yy = 1.1 + Math.sin(this.droneT * 3 + i) * 0.18;
          d.mesh.position.set(dx, yy, dz);
          d.mesh.rotation.set(0, d.a, 0);
          if (d.mesh.userData && d.mesh.userData.rotors) d.mesh.userData.rotors.rotation.y += dt * 26;
          // 后坐：开火瞬间整体缩一下再弹回
          if (d.recoil > 0) d.recoil = Math.max(0, d.recoil - dt * 6);
          d.mesh.scale.setScalar(1 + d.recoil * 0.35);
          d.mesh.visible = true;
          d.cd -= dt;
          if (d.cd <= 0){
            // 找最近敌人
            let nearest = null, bd = 30 * 30;
            for (let k = 0; k < list.length; k++){
              const e = list[k]; if (!e.alive) continue;
              const dd = Util.dist2(dx, dz, e.x, e.z);
              if (dd < bd){ bd = dd; nearest = e; }
            }
            if (nearest){
              d.cd = S.cd * rm;
              d.recoil = 1;
              const dir = Math.atan2(nearest.x - dx, nearest.z - dz);
              const crit = this.rollCrit();
              Bullets.fire(dx, dz, dir, 50, S.dmg * (crit ? this.critMul() : 1),
                { crit, color: 0xffcc33, scale: 0.7, life: 1.0, y: 1.1 });
              FX.ring(dx + Math.sin(dir) * 0.9, dz + Math.cos(dir) * 0.9, 0xffcc33, 1.4, 0.12);
              Audio2.droneBlip();
            }
          }
        } else d.mesh.visible = false;
      }
    } else {
      for (const d of this.drones) d.mesh.visible = false;
    }

    /* ---------- 湮灭新星 ---------- */
    const nl = Progress.w('nova');
    if (nl > 0){
      this.cd.nova -= dt;
      if (this.cd.nova <= 0 && (Enemies.pool.active.length > 0 || Boss.active)){
        const S = this.TABLE.nova[nl - 1];
        this.cd.nova = S.cd * rm;
        FX.ring(Player.x, Player.z, 0xff5d8a, S.r, 0.5);
        FX.ring(Player.x, Player.z, 0xffd24a, S.r * 0.62, 0.36);
        FX.ring(Player.x, Player.z, 0xffffff, S.r * 0.3, 0.22);   // 核心白闪
        FX.burst(Player.x, Player.z, 0xff5d8a, 16, 8, 1.4);        // 星爆射线
        FX.burst(Player.x, Player.z, 0xffffff, 7, 4.5, 1.4);       // 核心白芯
        const hits = Enemies.queryHit(Player.x, Player.z, S.r);
        for (const e of hits){
          const crit = this.rollCrit();
          Enemies.damage(e, S.dmg * (crit ? this.critMul() : 1), crit, e.x, e.z);
        }
        if (Boss.active && Boss.hitTest(Player.x, Player.z, S.r))
          Boss.damage(S.dmg * 0.7, false, Boss.x, Boss.z);
        Audio2.novaBurst();
      }
    }

    /* ---------- 回旋飞锯 ---------- */
    const wl = Progress.w('saw');
    if (wl > 0){
      this.cd.saw -= dt;
      if (this.cd.saw <= 0 && T){
        const S = this.TABLE.saw[wl - 1];
        this.cd.saw = S.cd * rm;
        const base = Math.atan2(T.x - Player.x, T.z - Player.z);
        let thrown = 0;
        for (let i = 0; i < this.saws.length && thrown < S.n; i++){
          const s = this.saws[i];
          if (s.active) continue;
          const a = base + (thrown - (S.n - 1) / 2) * 0.32;
          s.active = true; s.t = 0; s.life = S.out * 2 + 0.8; s.out = S.out; s.returning = false;
          s.x = Player.x; s.z = Player.z;
          s.vx = Math.sin(a) * S.spd; s.vz = Math.cos(a) * S.spd;
          s.dmg = S.dmg; s.hits = new Set(); s.bossHit = false; s.spin = 0;
          s.mesh.visible = true;
          thrown++;
        }
        if (thrown) Audio2.sawWhirl();
      }
    }
    // 飞锯飞行 / 回旋归位
    for (const s of this.saws){
      if (!s.active) continue;
      s.t += dt; s.life -= dt;
      if (s.life <= 0){ s.active = false; s.mesh.visible = false; if (s.disc) s.disc.visible = false; continue; }
      if (s.t > s.out && !s.returning){ s.returning = true; s.life = Math.max(s.life, 2.6); }
      if (s.returning){
        // 回旋归位：以高于玩家最高移速(26)的速度追向玩家自身，稳定飞回，不再"追不上就消失"
        const dx = Player.x - s.x, dz = Player.z - s.z, d = Math.hypot(dx, dz);
        const rs = 30;
        if (d > 0.001){ s.vx = dx / d * rs; s.vz = dz / d * rs; }
        if (d < 1.4){ s.active = false; s.mesh.visible = false; if (s.disc) s.disc.visible = false; continue; }
      } else {
        Util.clampArena(s, 0.5);              // 仅外抛阶段限制在场内
      }
      s.x += s.vx * dt; s.z += s.vz * dt;
      s.spin += dt * 16;
      s.mesh.position.set(s.x, 1.0, s.z);
      s.mesh.rotation.set(0, s.spin, 0);
      s.mesh.material.opacity = 0.9;
      if (s.disc){ s.disc.visible = true; s.disc.position.set(s.x, 1.0, s.z); s.disc.material.opacity = 0.5; }
      const hits = Enemies.queryHit(s.x, s.z, 1.4);
      for (const e of hits){
        if (s.hits.has(e._pi)) continue;
        s.hits.add(e._pi);
        const crit = this.rollCrit();
        Enemies.damage(e, s.dmg * (crit ? this.critMul() : 1), crit, e.x, e.z);
        FX.hitSpark(e.x, e.z, 0xffd24a, 1.0);
      }
      if (Boss.active && !s.bossHit && Boss.hitTest(s.x, s.z, 1.4)){
        Boss.damage(s.dmg, false, s.x, s.z); s.bossHit = true;
      }
    }

    /* ---------- 电磁轨道炮 ---------- */
    const rl = Progress.w('rail');
    if (rl > 0){
      this.cd.rail -= dt;
      if (this.cd.rail <= 0 && T){
        const S = this.TABLE.rail[rl - 1];
        this.cd.rail = S.cd * rm;
        const dir = Math.atan2(T.x - Player.x, T.z - Player.z);
        const crit = this.rollCrit();
        Bullets.fire(Player.x, Player.z, dir, S.spd, S.dmg * (crit ? this.critMul() : 1),
          { pierce: S.pierce, crit, color: crit ? 0xffcc33 : 0x9df6ff, scale: 1.4, life: 2.4, long: 3.2, y: 1.0 });
        FX.ring(Player.x, Player.z, 0x9df6ff, 3, 0.18);
        Audio2.rail();
      }
    }

    /* ---------- 烈焰喷射 ---------- */
    const fl = Progress.w('flame');
    if (fl > 0){
      this.cd.flame -= dt;
      if (this.cd.flame <= 0){
        const S = this.TABLE.flame[fl - 1];
        this.cd.flame = S.cd * rm;
        const base = T ? Math.atan2(T.x - Player.x, T.z - Player.z) : Player.yaw;
        const list = Enemies.pool.active;
        for (let i = 0; i < list.length; i++){
          const e = list[i]; if (!e.alive) continue;
          const dx = e.x - Player.x, dz = e.z - Player.z;
          const d = Math.hypot(dx, dz);
          if (d > S.range + e.r) continue;
          const ang = Math.atan2(dx, dz);
          const da = Math.abs(((ang - base + Math.PI) % Util.TAU) - Math.PI);
          if (da > S.arc) continue;
          const crit = this.rollCrit();
          Enemies.damage(e, S.dmg * (crit ? this.critMul() : 1), crit, e.x, e.z);
        }
        if (Boss.active && !Boss.entering){
          const dx = Boss.x - Player.x, dz = Boss.z - Player.z, d = Math.hypot(dx, dz);
          if (d <= S.range + Boss.r){
            const ang = Math.atan2(dx, dz);
            const da = Math.abs(((ang - base + Math.PI) % Util.TAU) - Math.PI);
            if (da <= S.arc) Boss.damage(S.dmg, false, Player.x, Player.z);
          }
        }
        if (T){
          for (let k = 0; k < 9; k++){
            const a = base + Util.rand(-S.arc, S.arc);
            const r = Util.rand(1.5, S.range);
            FX.particle(Player.x + Math.sin(a) * r, 1.0 + Math.random() * 0.6,
              Player.z + Math.cos(a) * r, Util.pick([0xff9a3d, 0xffd24a, 0xff5a2f]),
              { life: Util.rand(0.2, 0.45), s0: Util.rand(0.4, 0.8), s1: 0, drag: 2.2,
                vx: Math.sin(a) * 4, vz: Math.cos(a) * 4, vy: Util.rand(1, 3) });
          }
          Audio2.flame();
        }
      }
    }

    /* ---------- 声波脉冲 ---------- */
    const pl = Progress.w('pulse');
    if (pl > 0){
      this.cd.pulse -= dt;
      if (this.cd.pulse <= 0){
        const S = this.TABLE.pulse[pl - 1];
        this.cd.pulse = S.cd * rm;
        this.pulses.push({ x: Player.x, z: Player.z, t: 0, life: 0.6, maxR: S.r, dmg: S.dmg, hit: new Set(), col: 0x39e0ff });
        FX.ring(Player.x, Player.z, 0x39e0ff, S.r, 0.6);
        Audio2.pulse();
      }
    }
    // 推进所有脉冲波（薄壳命中，像涟漪扫过敌群）
    for (let i = this.pulses.length - 1; i >= 0; i--){
      const p = this.pulses[i];
      p.t += dt;
      if (p.t >= p.life){ this.pulses.splice(i, 1); continue; }
      const tt = p.t / p.life;
      const radius = Util.lerp(0.5, p.maxR, 1 - Math.pow(1 - tt, 2));
      const list = Enemies.pool.active;
      for (let j = 0; j < list.length; j++){
        const e = list[j]; if (!e.alive || p.hit.has(e._pi)) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (Math.abs(d - radius) < 1.3){
          const crit = this.rollCrit();
          Enemies.damage(e, p.dmg * (crit ? this.critMul() : 1), crit, e.x, e.z);
          p.hit.add(e._pi);
        }
      }
      if (Boss.active && !Boss.entering && !p.hit.has('boss')){
        const d = Math.hypot(Boss.x - p.x, Boss.z - p.z);
        if (Math.abs(d - radius) < 1.3){ Boss.damage(p.dmg, false, p.x, p.z); p.hit.add('boss'); }
      }
    }

    /* ---------- 光束衰减 ---------- */
    for (const b of this.beams){
      if (b.life > 0){
        b.life -= dt * 4.2;
        if (b.life <= 0){ b.life = 0; b.mesh.visible = false; }
        else { b.outer.material.opacity = 0.5 * b.life; b.core.material.opacity = 0.95 * b.life; }
      }
    }
    /* ---------- 闪电衰减 ---------- */
    for (const b of this.bolts){
      if (b.life > 0){
        b.life -= dt * 6;
        if (b.life <= 0){ b.life = 0; b.line.visible = false; }
        else b.line.material.opacity = Math.min(1, b.life * 1.2);
      }
    }
  },

  pickTargets(n){
    const list = Enemies.pool.active;
    const arr = [];
    for (let i = 0; i < list.length; i++){
      const e = list[i];
      const d = Util.dist2(Player.x, Player.z, e.x, e.z);
      if (d < 46 * 46) arr.push({ e, d });
    }
    arr.sort((a, b) => a.d - b.d);
    const out = arr.slice(0, n).map(o => o.e);
    if (!out.length && Boss.active && !Boss.entering) out.push(Boss.asTarget());
    return out;
  },

  /** 贯穿光束：沿射线打到所有敌人 */
  beam(target, S, lv){
    const dir = Math.atan2(target.x - Player.x, target.z - Player.z);
    const len = 54;
    const dx = Math.sin(dir), dz = Math.cos(dir);
    const crit = this.rollCrit();
    const dmg = S.dmg * (crit ? this.critMul() : 1);

    // 沿线段采样命中（步进法，简单可靠）
    const seen = new Set();
    const step = 1.5;
    for (let t = 1; t < len; t += step){
      const px = Player.x + dx * t, pz = Player.z + dz * t;
      const hits = Enemies.queryHit(px, pz, S.w + 0.9);
      for (const e of hits){
        if (seen.has(e._pi)) continue;
        seen.add(e._pi);
        Enemies.damage(e, dmg, crit, e.x, e.z);
      }
      if (Boss.active && Boss.hitTest(px, pz, S.w + 0.9) && !seen.has('boss')){
        seen.add('boss'); Boss.damage(dmg, crit, px, pz);
      }
    }

    // 视觉
    const b = this.beams.find(x => x.life <= 0);
    if (b){
      b.life = 1;
      b.mesh.visible = true;
      b.mesh.position.set(Player.x, 1.0, Player.z);
      b.mesh.rotation.set(0, dir, 0);
      b.outer.scale.set(S.w, S.w, len);
      b.core.scale.set(S.w * 0.42, S.w * 0.42, len);
      b.outer.material.color.setHex(crit ? 0xffcc33 : 0x9df6ff);
      b.outer.material.opacity = 0.5;
      b.core.material.color.setHex(0xffffff);
      b.core.material.opacity = 0.95;
    }
    FX.burst(Player.x + dx * 1.6, Player.z + dz * 1.6, 0x9df6ff, 4, 4, 1);
  },
};

/* ============================ Wingmen 僚机 ============================ */
/* 行为：free=自主游走去索敌压制（默认）；follow=跟随编队；guard=贴身护卫圈 */
const Wingmen = {
  list: [], group: null, formation: 0, orbT: 0,
  behavior: 'free',
  BEHAVIORS: ['自主游走', '跟随编队', '贴身护卫'],
  FORMS: ['楔形跟随', '环绕护卫', '横列展开'],

  SPEC: {
    striker:  { name:'突击僚机', color: CFG.colors.striker,  cd:0.62, dmg:11, spd:26, mesh:'wing_a',       s:0.9  },
    warden:   { name:'守护僚机', color: CFG.colors.warden,   cd:1.30, dmg:7,  spd:22, mesh:'wing_b',       s:0.9  },
    howitzer: { name:'榴弹僚机', color: CFG.colors.howitzer, cd:1.75, dmg:30, spd:18, mesh:'enemy_charger', s:0.9  },
    phantom:  { name:'幽灵刺客', color:0xb980ff,              cd:1.50, dmg:42, spd:24, mesh:'enemy_orbiter', s:0.95 },
    medic:    { name:'医疗机',   color:0x6dff8b,              cd:3.20, dmg:0,  spd:24, mesh:'hauler',       s:0.95 },
  },

  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);
  },

  add(type){
    if (this.list.length >= 6) return null;
    const S = this.SPEC[type];
    if (!S) return null;
    const built = (type === 'medic') ? Gfx.medic(S.color, S.s) : Gfx.ship(S.mesh, S.color, S.s);
    const g = new THREE.Group();
    built.g.position.y = 1.5;
    g.add(built.g);
    const thr = Gfx.thruster(S.color, 0.22, -0.7);
    thr.position.y = 1.5;
    g.add(thr);
    g.add(Gfx.glow(S.color, 1.3, 0.22));
    this.group.add(g);

    const w = {
      type, spec: S, g, shipG: built.g, thr,
      x: Player.x, z: Player.z, vx: 0, vz: 0, yaw: 0, cd: Math.random() * S.cd,
      slot: this.list.length, bob: Math.random() * 6,
    };
    this.list.push(w);
    this.reslot();
    FX.ring(Player.x, Player.z, S.color, 6, 0.5);
    return w;
  },

  reslot(){ this.list.forEach((w, i) => { w.slot = i; }); },

  cycleFormation(){
    this.formation = (this.formation + 1) % 3;
    this.behavior = ['free', 'follow', 'guard'][this.formation];
    if (Game.state === 'PLAYING') HUD.toast(this.BEHAVIORS[this.formation], '僚机行为', '#ffcc33', 0.9);
    return this.formation;
  },

  /** 队形目标点 */
  slotPos(w, i, n){
    const back = Player.yaw + Math.PI;
    if (this.formation === 0){                 // 楔形：分列机尾两侧
      const side = (i % 2 ? 1 : -1);
      const row = Math.floor(i / 2) + 1;
      const d = 3.0 + row * 1.5, lat = side * (1.9 + row * 0.55);
      return { x: Player.x + Math.sin(back) * d + Math.cos(back) * lat,
               z: Player.z + Math.cos(back) * d - Math.sin(back) * lat };
    }
    if (this.formation === 1){                 // 环绕
      const a = this.orbT + i / Math.max(1, n) * Util.TAU;
      const r = 5.4;
      return { x: Player.x + Math.cos(a) * r, z: Player.z + Math.sin(a) * r };
    }
    // 横列：垂直于朝向一字排开
    const side = (i % 2 ? 1 : -1), row = Math.floor(i / 2) + 1;
    const lat = side * row * 2.9;
    return { x: Player.x + Math.cos(Player.yaw) * lat,
             z: Player.z - Math.sin(Player.yaw) * lat };
  },

  update(dt){
    this.orbT += dt * 0.8;
    const n = this.list.length;
    const px = Player.x, pz = Player.z;
    for (let i = 0; i < n; i++){
      const w = this.list[i];
      w.bob += dt;

      // 自主索敌：比玩家更宽的视野，体现「自由」
      const tgt = Weapons.nearestTo(w.x, w.z, 44) ||
                  (Boss.active && !Boss.entering ? Boss.asTarget() : null);

      // 期望位置
      let dx, dz;
      if (this.behavior === 'follow'){
        const p = this.slotPos(w, i, n);
        dx = p.x - w.x; dz = p.z - w.z;
      } else if (this.behavior === 'guard'){
        const a = this.orbT * 0.6 + i / Math.max(1, n) * Util.TAU;
        const R = 4.2;
        dx = (px + Math.cos(a) * R) - w.x;
        dz = (pz + Math.sin(a) * R) - w.z;
      } else {                                   // free：自主游走
        if (tgt){
          const td = Math.hypot(tgt.x - w.x, tgt.z - w.z);
          dx = tgt.x - w.x; dz = tgt.z - w.z;
          if (td < 11){ dx *= 0.15; dz *= 0.15; }   // 进入射程就悬停压制
        } else {
          const ang = this.orbT * 0.5 + w.slot * 2.0;
          const R = 8 + w.slot * 1.3;
          dx = (px + Math.cos(ang) * R) - w.x;
          dz = (pz + Math.sin(ang) * R) - w.z;
        }
        // 自由模式牵绳更长：过远则被拉回
        const pd = Math.hypot(w.x - px, w.z - pz);
        if (pd > 26){ dx += (px - w.x) * 1.2; dz += (pz - w.z) * 1.2; }
      }

      // 僚机彼此分离，避免叠成一坨
      for (let j = 0; j < n; j++){
        if (j === i) continue;
        const o = this.list[j];
        const ddx = w.x - o.x, ddz = w.z - o.z;
        const d2 = ddx*ddx + ddz*ddz;
        if (d2 < 9 && d2 > 0.001){
          const d = Math.sqrt(d2);
          dx += ddx / d * (1 - d / 3) * 1.4;
          dz += ddz / d * (1 - d / 3) * 1.4;
        }
      }

      // 远离敌人：不要撞上去（保持缓冲，自由模式仍能贴近火力压制）
      {
        const ea = Enemies.pool.active;
        for (let j = 0; j < ea.length; j++){
          const e = ea[j]; if (!e.alive) continue;
          const edx = w.x - e.x, edz = w.z - e.z;
          const ed2 = edx*edx + edz*edz;
          const er = (e.r || 1) + 3.0;
          if (ed2 < er*er && ed2 > 0.001){
            const d = Math.sqrt(ed2);
            const f = (1 - d / er) * 2.8;
            dx += edx / d * f; dz += edz / d * f;
          }
        }
      }

      const l = Math.hypot(dx, dz) || 1;
      const sp = (this.behavior === 'follow' ? w.spec.spd * 0.85 : w.spec.spd);
      const k = 1 - Math.exp(-7 * dt);
      w.vx += (dx / l * sp - w.vx) * k;
      w.vz += (dz / l * sp - w.vz) * k;
      w.x += w.vx * dt; w.z += w.vz * dt;
      Util.clampArena(w, 0.6);
      // 硬解算：万一贴太近，直接把僚机推出敌人，绝不嵌进去
      {
        const ea = Enemies.pool.active;
        for (let j = 0; j < ea.length; j++){
          const e = ea[j]; if (!e.alive) continue;
          const edx = w.x - e.x, edz = w.z - e.z;
          const ed2 = edx*edx + edz*edz;
          const er = (e.r || 1) + 1.2;
          if (ed2 < er*er && ed2 > 0.001){
            const d = Math.sqrt(ed2);
            const need = er - d;
            w.x += edx / d * need; w.z += edz / d * need;
          }
        }
        Util.clampArena(w, 0.6);
      }

      // 开火
      w.cd -= dt;
      // 医疗机：定时给玩家回血（不需目标，不射击）
      if (w.type === 'medic'){
        if (w.cd <= 0 && Player.hp < Player.maxHp){
          w.cd = w.spec.cd;
          Player.heal(6);
          FX.ring(w.x, w.z, w.spec.color, 3.2, 0.32);
          FX.cross(Player.x, Player.z, w.spec.color);
        }
        w.yaw = Util.angLerp(w.yaw, Math.atan2(px - w.x, pz - w.z), 1 - Math.exp(-5 * dt));
      } else if (tgt){
        w.yaw = Util.angLerp(w.yaw, Math.atan2(tgt.x - w.x, tgt.z - w.z), 1 - Math.exp(-10 * dt));
        if (w.cd <= 0){
          w.cd = w.spec.cd * Weapons.rateMul();
          const crit = Weapons.rollCrit();
          const mul = crit ? Weapons.critMul() : 1;
          const dir = Math.atan2(tgt.x - w.x, tgt.z - w.z);
          if (w.type === 'striker'){
            for (let s = 0; s < 2; s++)
              Bullets.fire(w.x, w.z, dir + (s - 0.5) * 0.1, w.spec.spd,
                w.spec.dmg * mul, { crit, y: 1.4, color: crit ? 0xffcc33 : 0xffe08a,
                  scale: 0.8, life: 1.1 });
          } else if (w.type === 'howitzer'){
            Bullets.missile(w.x, w.z, w.spec.dmg * mul, tgt,
              { dir, splash: 4.4, crit, spd: 10, scale: 1.25, color: 0xff8a3d, turn: 3.4 });
          } else if (w.type === 'phantom'){
            // 幽灵刺客：高伤穿透直射
            Bullets.fire(w.x, w.z, dir, w.spec.spd * 0.7, w.spec.dmg * mul,
              { crit, y: 1.5, color: 0xb980ff, scale: 1.25, life: 1.4, pierce: 2 });
          } else {
            Bullets.fire(w.x, w.z, dir, w.spec.spd, w.spec.dmg * mul,
              { crit, y: 1.4, color: 0x5dff9b, scale: 0.9, life: 0.8 });
          }
          FX.burst(w.x + Math.sin(dir) * 0.9, w.z + Math.cos(dir) * 0.9, w.spec.color, 3, 2, 1.4);
          Audio2.shoot();
        }
      } else {
        w.yaw = Util.angLerp(w.yaw, Math.atan2(px - w.x, pz - w.z), 1 - Math.exp(-5 * dt));
      }

      // 表现
      const moving = Math.hypot(w.vx, w.vz);
      w.g.position.set(w.x, 0, w.z);
      w.shipG.rotation.y = w.yaw;
      w.shipG.position.y = 1.5 + Math.sin(w.bob * 3) * 0.13;
      w.shipG.rotation.z = Math.sin(w.bob * 1.7) * 0.1 + Util.clamp(-w.vx * 0.04, -0.3, 0.3);
      w.thr.rotation.y = w.yaw;
      w.thr.scale.set(0.7 + Math.min(1, moving / 30), 0.7 + Math.min(1, moving / 30), 1);
      if (moving > 6 && Math.random() < 0.4)
        FX.particle(w.x - Math.sin(w.yaw) * 1.0, 0.7, w.z - Math.cos(w.yaw) * 1.0, w.spec.color,
          { life: 0.3, s0: 0.35, s1: 0, drag: 4 });
    }
  },

  /** warden 拦截敌弹：返回拦截者 */
  intercept(x, z, r){
    for (const w of this.list){
      if (w.type !== 'warden') continue;
      if (Util.dist2(x, z, w.x, w.z) < (r + 2.1) ** 2) return w;
    }
    return null;
  },

  count(type){ return this.list.filter(w => w.type === type).length; },

  clear(){
    for (const w of this.list) this.group.remove(w.g);
    this.list.length = 0;
    this.formation = 0;
  },
};
