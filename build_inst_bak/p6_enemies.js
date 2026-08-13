
/* ============================ Enemies 敌人 ============================ */
const Enemies = {
  pool: null, group: null, spawnCd: 0,
  _curTint: null,   // 当前星域的统一敌群配色（分裂子代 / BOSS 召唤复用）
  blastQ: [],   // 重甲死亡爆炸队列，成对存 [x,z]，在 update 里迭代结算

  /* 种类基准值（会被波次系数放大） */
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
  },

  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);
    this._pid = 0;
    this.pool = Pool.create(300, () => ({
      mesh: null, kind: null, x:0, z:0, vx:0, vz:0, yaw:0,
      hp:0, maxHp:0, r:1, spd:0, dmg:0, xp:1, ai:'chase',
      t:0, fireCd:0, phase:0, hitT:0, slowT:0, slowK:0, elite:false, scale:1,
      blinkCd:0, healCd:0,
      alive:false, _pi:0, _ai:0,
    }));
  },

  /** 按模型 key 取一个可复用的 Group（多部件真 3D 模型），material 每实例独立以便闪白/变色 */
  _mkMesh(key, color){
    const r = Gfx.enemyShip(key, color, 1);
    if (!r) return null;
    this.group.add(r.g);
    return { mesh: r.g, mats: r.mats, children: r.meshes };
  },

  /**
   * @param kind   种类
   * @param hpMul  血量倍率
   * @param spdMul 速度倍率
   * @param scale  体型
   * @param elite  精英
   */
  spawn(kind, x, z, hpMul, spdMul, scale, elite, tint){
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
    e.t = Math.random() * 10; e.fireCd = Util.rand(0.6, 2.2);
    e.blinkCd = Util.rand(1.4, 3.0) + (e.ai === 'blink' ? 1 : 0);
    e.healCd  = Util.rand(1.5, 3.0) + (e.ai === 'support' ? 1 : 0);
    e.hitT = 0; e.slowT = 0; e.slowK = 0;
    e.yaw = Math.atan2(Player.x - x, Player.z - z);

    if (!e.mesh || e._mkKind !== kind){
      if (e.mesh) this.group.remove(e.mesh);
      // 机型多样化：从本种类的机型池里随机抽一个（颜色仍按种类，保证威胁辨识度）
      const mk = S.variants[Math.floor(Math.random() * S.variants.length)];
      e.modelKey = mk;
      const built = this._mkMesh(mk, S.color);
      e.mesh = built.mesh;       // 是 Group
      e.mats = built.mats;       // 各部件材质数组（独立实例，用于变色/闪白）
      e._mkKind = mk;
    }
    const col = elite ? 0xffffff : (tint != null ? tint : S.color);
    e.color = col;
    for (const mt of e.mats){
      mt.color.setHex(col);
      mt.emissive.setHex(elite ? 0xffcc33 : col);
      mt.emissiveIntensity = elite ? 0.55 : 0.22;
    }
    e.mesh.scale.setScalar(e.scale);
    e.mesh.position.set(x, 0.65 * e.scale, z);
    e.mesh.rotation.set(0, e.yaw, 0);
    e.mesh.visible = true;
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

  damage(e, dmg, crit, hx, hz){
    if (!e.alive) return;
    e.hp -= dmg;
    e.hitT = 0.1;
    Game.dmgDealt += dmg;
    FX.dmgText(hx == null ? e.x : hx, hz == null ? e.z : hz, dmg, crit);
    FX.hitSpark(e.x, e.z, e.color || this.SPEC[e.kind].color, 0.8);
    // 轻微击退（体型越大越稳）
    const kb = 5.5 / e.scale;
    const a = Math.atan2(e.x - Player.x, e.z - Player.z);
    e.vx += Math.sin(a) * kb; e.vz += Math.cos(a) * kb;
    if (e.hp <= 0) this.kill(e);
    else Audio2.hit();
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

    // 分裂
    if (e.kind === 'splitter' && e.scale > 0.55){
      for (let i = 0; i < 2; i++){
        const a = Math.random() * Util.TAU;
        const c = this.spawn('charger', e.x + Math.cos(a) * 1.4, e.z + Math.sin(a) * 1.4,
          Math.max(0.4, e.maxHp / this.SPEC.charger.hp * 0.30), 1.25, e.scale * 0.62, false, this._curTint);
        if (c){ c.vx = Math.cos(a) * 14; c.vz = Math.sin(a) * 14; }
      }
    }
    // 重甲死亡爆炸：进队列，下一帧迭代结算，杜绝连锁递归
    if (e.kind === 'brute'){
      FX.ring(e.x, e.z, 0xff7a2f, 9, 0.5);
      this.blastQ.push(e.x, e.z);
      if (Util.dist2(e.x, e.z, Player.x, Player.z) < 42) Player.takeDamage(10);
    }

    e.mesh.visible = false;
    this.pool.release(e);
  },

  update(dt){
    // 重建空间哈希
    Grid.clear();
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++) Grid.insert(list[i]);

    // 结算重甲连锁爆炸：迭代而非递归，并设上限防止极端情况刷屏
    let guard = 0;
    while (this.blastQ.length && guard++ < 64){
      const bz = this.blastQ.pop(), bx = this.blastQ.pop();
      this.splash(bx, bz, 6.5, 26, false);
    }
    if (this.blastQ.length) this.blastQ.length = 0;

    const px = Player.x, pz = Player.z;

    this.pool.each(e => {
      e.t += dt;
      if (e.hitT > 0) e.hitT -= dt;
      let sk = 1;
      if (e.slowT > 0){ e.slowT -= dt; sk = 1 - e.slowK; }

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
          Bullets.enemyFire(e.x, e.z, Math.atan2(dx, dz), 26, e.dmg,
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
          Bullets.enemyFire(e.x, e.z, toP, 22, e.dmg, { color: 0xb980ff, scale: 0.9 });
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
          const tx = px + Player.vx * lead, tz = pz + Player.vz * lead;
          const a = Math.atan2(tx - e.x, tz - e.z);
          Bullets.enemyFire(e.x, e.z, a, 40, e.dmg, { color: 0x4dd2ff, scale: 0.75, life: 3 });
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

      const sp = e.spd * sk;
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

      /* ---- 撞击玩家 ---- */
      const pr = CFG.player.radius + e.r;
      if (dist < pr && Game.state === 'PLAYING'){
        if (e.kind === 'kamikaze'){
          // 自杀冲锋：撞上即引爆，自身摧毁
          Player.takeDamage(e.dmg);
          FX.explode(e.x, e.z, 0xff5a3c, 1.4);
          World.shake(1.2, 0.3);
          this.kill(e);
        } else {
          Player.takeDamage(e.dmg);
          const a = Math.atan2(e.x - px, e.z - pz);
          e.vx = Math.sin(a) * 16; e.vz = Math.cos(a) * 16;
        }
      }

      /* ---- 表现 ---- */
      e.yaw = Util.angLerp(e.yaw, Math.atan2(e.vx, e.vz) || e.yaw, 1 - Math.exp(-8 * dt));
      const m = e.mesh;
      m.position.set(e.x, 0.65 * e.scale + Math.sin(e.t * 3 + e.x) * 0.08, e.z);
      m.rotation.y = e.yaw;
      if (e.kind === 'orbiter' || e.kind === 'splitter') m.rotation.y = e.t * 1.6;
      // 受击闪白
      const hf = e.hitT > 0 ? e.hitT / 0.1 : 0;
      const ei = (e.elite ? 0.55 : 0.22) + hf * 1.5;
      for (let mi = 0; mi < e.mats.length; mi++) e.mats[mi].emissiveIntensity = ei;
      if (hf > 0) m.scale.setScalar(e.scale * (1 + hf * 0.13));
      else if (Math.abs(m.scale.x - e.scale) > 0.001) m.scale.setScalar(e.scale);
      return false;
    });
  },

  clear(){
    this.blastQ.length = 0;
    this.pool.each(e => { if (e.mesh) e.mesh.visible = false; return true; });
  },
};

/* ============================ Loot 掉落 ============================ */
const Loot = {
  pool: null, group: null,

  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);
    const geo = new THREE.OctahedronGeometry(0.34, 0);
    this.pool = Pool.create(400, () => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x38f0ff }));
      m.visible = false;
      this.group.add(m);
      return { mesh: m, x:0, z:0, y:0.5, vx:0, vz:0, val:1, kind:'xp', t:0, mag:false };
    });
  },

  _put(x, z, val, kind, color, scale){
    const o = this.pool.get(); if (!o) return null;
    o.x = x; o.z = z; o.y = 0.55; o.val = val; o.kind = kind;
    o.t = Math.random() * 6; o.mag = false;
    const a = Math.random() * Util.TAU, sp = Util.rand(2, 6);
    o.vx = Math.cos(a) * sp; o.vz = Math.sin(a) * sp;
    o.mesh.material.color.setHex(color);
    o.mesh.scale.setScalar(scale);
    o.mesh.position.set(x, o.y, z);
    o.mesh.visible = true;
    return o;
  },

  dropGem(x, z, val){
    const c = val >= 20 ? 0xb980ff : (val >= 5 ? 0x5dff9b : 0x38f0ff);
    const s = val >= 20 ? 1.5 : (val >= 5 ? 1.15 : 0.85);
    return this._put(x, z, val, 'xp', c, s);
  },

  dropHeal(x, z){ return this._put(x, z, 25, 'hp', 0xff3d7f, 1.35); },

  update(dt){
    const pr = Player.pickR;
    const pr2 = pr * pr;
    this.pool.each(o => {
      o.t += dt;
      // 初速衰减
      const k = Math.exp(-5 * dt);
      o.vx *= k; o.vz *= k;
      o.x += o.vx * dt; o.z += o.vz * dt;

      const d2 = Util.dist2(o.x, o.z, Player.x, Player.z);
      if (o.mag || d2 < pr2){
        o.mag = true;
        const d = Math.sqrt(d2) || 1;
        const sp = CFG.magnetSpd * Util.clamp(1.4 - d / 22, 0.55, 1.6);
        o.x += (Player.x - o.x) / d * sp * dt;
        o.z += (Player.z - o.z) / d * sp * dt;
        if (d < 1.3){
          if (o.kind === 'hp'){ Player.heal(o.val); Audio2.gem(); }
          else { Progress.gainExp(o.val); Audio2.gem(); }
          FX.particle(o.x, 0.8, o.z, o.kind === 'hp' ? 0xff3d7f : 0x9df6ff,
            { life: 0.3, s0: 0.55, s1: 0, drag: 4 });
          o.mesh.visible = false;
          return true;
        }
      }
      o.mesh.position.set(o.x, 0.55 + Math.sin(o.t * 3.4) * 0.16, o.z);
      o.mesh.rotation.y = o.t * 2.1;
      o.mesh.rotation.x = o.t * 1.3;
      return false;
    });
  },

  /** 全屏吸取（升级奖励用） */
  magnetAll(){ for (const o of this.pool.active) o.mag = true; },

  clear(){ this.pool.each(o => { o.mesh.visible = false; return true; }); },
};
