
/* ============================ Boss 深渊母舰 ============================ */
const Boss = {
  active: false, entering: false, phase: 1,
  hp: 0, maxHp: 8600,
  x: 0, z: -34, t: 0, yaw: 0,
  g: null, ud: null,
  atkCd: 0, spinCd: 0, summonCd: 0, chargeT: 0, chargeCd: 0,
  _target: { x: 0, z: 0, r: 5.2, alive: true },
  r: 5.2,

  init(){
    this.g = Gfx.boss();
    this.ud = this.g.userData;
    this.g.visible = false;
    World.scene.add(this.g);
  },

  spawn(round){
    this.active = true; this.entering = true;
    this.phase = 1;
    this.round = round || 0;
    this.maxHp = Math.round(8600 * (1 + 0.45 * this.round));   // 无尽轮次强化（每轮 +45% 血）
    this.hp = this.maxHp;
    this.x = 0; this.z = Player.z - 46;
    this.t = 0; this.yaw = 0;
    this.atkCd = 2.4; this.spinCd = 5; this.summonCd = 6; this.chargeCd = 9; this.chargeT = 0;
    this.g.visible = true;
    this.g.position.set(this.x, 5.5, this.z);
    this.g.scale.setScalar(0.15);
    HUD.showBoss(true);
    HUD.toast('深渊母舰 NYX-Ω', 'WARNING · 歼灭目标', '#ff3d7f', 2.6);
    Audio2.bossWarn();
    World.shake(2.2, 0.9);
    return this;
  },

  asTarget(){
    this._target.x = this.x; this._target.z = this.z;
    this._target.alive = this.active;
    this._target.r = this.r;
    return this._target;
  },

  hitTest(x, z, r){
    if (!this.active || this.entering) return false;
    const rr = r + this.r;
    return Util.dist2(x, z, this.x, this.z) <= rr * rr;
  },

  damage(n, crit, hx, hz){
    if (!this.active || this.entering) return;
    this.hp -= n;
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
        FX.explode(this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, 0xff3d7f, 2.2);
        Audio2.boom();
      }, i * 90);
    }
    for (let i = 0; i < 26; i++)
      Loot.dropGem(this.x + Util.rand(-8, 8), this.z + Util.rand(-8, 8), 20);
    this.g.visible = false;
    if (Game.endless){
      // 无尽模式：击破后进入更高难度的下一轮 BOSS，而非结束（修复 BOSS 链断裂）
      HUD.toast('深渊母舰已歼灭', 'WARNING · 下一轮来袭', '#ff3d7f', 2.2);
      setTimeout(() => { if (Game.state === 'PLAYING') Game.nextBossRound(); }, 200);
    } else {
      setTimeout(() => { if (Game.state === 'PLAYING') Game.over(true); }, 200);
    }
  },

  update(dt){
    if (!this.active) return;
    this.t += dt;

    /* ---- 进场演出：从远处缩放降落 ---- */
    if (this.entering){
      const k = Util.clamp(this.t / 2.6, 0, 1);
      const e = 1 - Math.pow(1 - k, 3);
      this.g.scale.setScalar(0.6 + e * 0.6);
      this.g.position.set(
        Util.lerp(this.x, Player.x, e * 0.55),
        Util.lerp(14, 4.6, e),
        Util.lerp(Player.z - 46, Player.z - 24, e));
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
      HUD.toast('阶段 II · 狂暴', 'NYX-Ω 核心过载', '#ffcc33', 2);
      Audio2.bossWarn();
      World.shake(2.6, 0.8);
      FX.ring(this.x, this.z, 0xffcc33, 30, 0.9);
      this.ud.hull.traverse(c => { if (c.isMesh && c.material.emissive) c.material.emissive.setHex(0xffcc33); });
      this.atkCd = 0.6;
    }
    const P2 = this.phase === 2;

    /* ---- 移动：缓慢逼近玩家，保持 17 距离 ---- */
    if (this.chargeT > 0){
      this.chargeT -= dt;
      const a = this.yaw;
      this.x += Math.sin(a) * 34 * dt;
      this.z += Math.cos(a) * 34 * dt;
      FX.particle(this.x, 3, this.z, 0xff3d7f, { life: 0.4, s0: 1.6, s1: 0, drag: 3 });
      if (Util.dist2(this.x, this.z, Player.x, Player.z) < (this.r + CFG.player.radius) ** 2)
        Player.takeDamage(26);
    } else {
      const dx = Player.x - this.x, dz = Player.z - this.z;
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
          a, P2 ? 20 : 16, 11, { color: 0xff3d7f, scale: 1.15, life: 5 });
      }
      FX.ring(this.x, this.z, 0xff3d7f, this.r * 2.4, 0.35);
      Audio2.tone(90, 0.2, 'sawtooth', 0.1, 40);
    }

    // 2) 追踪散射
    if (this.spinCd <= 0){
      this.spinCd = P2 ? 3.0 : 4.6;
      const base = Math.atan2(Player.x - this.x, Player.z - this.z);
      const n = P2 ? 9 : 5;
      for (let i = 0; i < n; i++){
        const a = base + (i - (n - 1) / 2) * 0.19;
        Bullets.enemyFire(this.x, this.z, a, 30, 13,
          { color: 0xffcc33, scale: 0.95, life: 4 });
      }
      FX.burst(this.x, this.z, 0xffcc33, 8, 6, 2);
    }

    // 3) 召唤护卫
    if (this.summonCd <= 0){
      this.summonCd = P2 ? 6.5 : 9;
      const n = P2 ? 6 : 4;
      for (let i = 0; i < n; i++){
        const a = i / n * Util.TAU + Math.random();
        const kind = P2 ? Util.pick(['charger', 'orbiter', 'splitter']) : 'charger';
        Enemies.spawn(kind, this.x + Math.cos(a) * 9, this.z + Math.sin(a) * 9,
          1.6 + Game.wave * 0.14, 1.1, 1, false, Game.stageTint);
      }
      FX.ring(this.x, this.z, 0xb980ff, 13, 0.5);
    }

    // 4) P2 冲撞
    if (P2 && this.chargeCd <= 0 && this.chargeT <= 0){
      this.chargeCd = 8.5; this.chargeT = 0.85;
      this.yaw = Math.atan2(Player.x - this.x, Player.z - this.z);
      HUD.toast('突进！', '', '#ff3d7f', 0.7);
      World.shake(1.2, 0.3);
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
    const coreCol = new THREE.Color(P2 ? 0xffcc33 : 0xff8ab0);
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
    this.hp = 0; this.chargeT = 0;
    if (this.g){
      this.g.visible = false;
      this.ud.hull.traverse(c => { if (c.isMesh && c.material.emissive) c.material.emissive.setHex(CFG.colors.boss); });
    }
    HUD.showBoss(false);
  },
};

/* ============================ Progress 成长 ============================ */
const Progress = {
  level: 1, exp: 0, need: 5, pending: 0,
  weapons: {}, passives: {},
  cards: [],

  W_INFO: {
    cannon:  { name:'脉冲主炮', icon:'✦', desc:'向索敌方向连射能量弹' },
    missile: { name:'追踪导弹', icon:'◈', desc:'自动追踪，命中爆炸溅射' },
    laser:   { name:'相位激光', icon:'≡', desc:'瞬发贯穿光束，无视队列' },
    aura:    { name:'湮灭力场', icon:'◎', desc:'环绕自身持续灼烧并减速' },
    spread:  { name:'散射霰弹', icon:'❋', desc:'近距扇形霰弹覆盖' },
    orbit:   { name:'环绕光刃', icon:'✺', desc:'环绕自身的旋转斩击' },
    chain:   { name:'连锁闪电', icon:'⚡', desc:'电弧在敌人间弹跳' },
    drone:   { name:'无人僚机', icon:'◢', desc:'召唤无人机环绕攻击' },
    nova:    { name:'湮灭新星', icon:'✷', desc:'自身为中心爆发冲击波' },
    saw:     { name:'回旋飞锯', icon:'❂', desc:'掷出旋转刃穿透回旋' },
    rail:    { name:'电磁轨道炮', icon:'⇶', desc:'蓄能贯穿重炮，一发撕穿全场' },
    flame:   { name:'烈焰喷射', icon:'🔥', desc:'前方扇形持续灼烧' },
    pulse:   { name:'声波脉冲', icon:'◉', desc:'扩散冲击波，横扫近身敌群' },
  },
  G_INFO: {
    striker:  { name:'突击僚机', icon:'▲', desc:'高频双联装，压制杂兵' },
    warden:   { name:'守护僚机', icon:'⬢', desc:'拦截敌方弹幕，贴身护卫' },
    howitzer: { name:'榴弹僚机', icon:'●', desc:'抛射高爆弹，大范围杀伤' },
    phantom:  { name:'幽灵刺客', icon:'◣', desc:'高伤穿透直射，绕背突袭' },
    medic:    { name:'医疗机',   icon:'✚', desc:'定期为玩家恢复生命值' },
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
    const ship = Player.cfg || SHIPS[0];
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
      Player.maxHp = Player.cfg.hp + this.p('hp') * 22;
      Player.hp = Player.maxHp;
    }
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
    if (this.pending > 0 && Game.state === 'PLAYING') Game.openLevelUp();
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
      if (k === 'hp' && Player.hp / Player.maxHp < 0.5) w = 34;   // 残血时更容易出防御
      if (k === 'armor' && Player.hp / Player.maxHp < 0.5) w = 30;
      opts.push({ type:'passive', key:k, lv, weight: w });
    }
    // 保底治疗
    if (Player.hp < Player.maxHp * 0.75)
      opts.push({ type:'heal', key:'heal', lv:0, weight: Player.hp / Player.maxHp < 0.35 ? 26 : 10 });

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
      else
        o.diff = nx.n + ' 发 · 伤害 ' + nx.dmg + (nx.pierce ? ' · 穿透 ' + nx.pierce : '');
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
      o.diff = '生命回满 (' + Math.round(Player.maxHp - Player.hp) + ' HP)';
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
        Player.maxHp = Player.cfg.hp + this.p('hp') * 22;
        Player.heal(22);
      }
    } else if (c.type === 'heal'){
      Player.heal(Player.maxHp);
    } else if (c.type === 'mutation'){
      this.passives.rate  = Math.min(5, this.p('rate') + 2);
      this.passives.crit  = Math.min(5, this.p('crit') + 2);
      this.passives.speed = Math.min(5, this.p('speed') + 1);
      this.passives.hp    = Math.min(5, this.p('hp') + 1);
      Player.maxHp = Player.cfg.hp + this.p('hp') * 22;
      Player.heal(22);
    }
    Audio2.levelup();
    HUD.renderGear();
  },
};
