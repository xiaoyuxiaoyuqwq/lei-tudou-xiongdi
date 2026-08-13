
/* ============================ HUD 界面 ============================ */
const HUD = {
  el: {},
  toastT: 0,

  init(){
    const id = (s) => document.getElementById(s);
    this.el = {
      xpBar: id('xpBar'), xpTxt: id('xpTxt'),
      hpBar: id('hpBar'), hpTxt: id('hpTxt'),
      wave: id('hWave'), time: id('hTime'), kill: id('hKill'),
      fps: id('hFps'), dps: id('hDps'),
      gear: id('gear'),
      bossBar: id('bossBar'), bossFill: id('bossFill'), bossName: id('bossName'),
      toast: id('toast'), toastA: id('toastA'), toastB: id('toastB'),
      levelup: id('levelup'), cards: id('cards'), luLv: id('luLv'),
      overlay: id('overlay'), sTitle: id('sTitle'), sKick: id('sKick'), sSub: id('sSub'),
      sStats: id('sStats'), howto: id('howto'),
      rTime: id('rTime'), rKill: id('rKill'), rLv: id('rLv'), rWave: id('rWave'), rDps: id('rDps'),
      btnStart: id('btnStart'), btnEndless: id('btnEndless'), btnMenuR: id('btnMenuR'),
      pause: id('pause'), hitFlash: id('hitFlash'), boot: id('boot'),
      btnSound: id('btnSound'),
      shipRow: id('shipRow'),
      waveBanner: id('waveBanner'), wbNum: id('wbNum'), wbTxt: id('wbTxt'),
      btnResume: id('btnResume'), btnRestart: id('btnRestart'), btnMenu: id('btnMenu'),
      sector: id('hSector'), sbNum: id('sbNum'), sbTxt: id('sbTxt'), sectorBanner: id('sectorBanner'),
    };

    this.el.btnStart.addEventListener('click', () => { Audio2.init(); Audio2.resume(); Game.start(false); });
    this.el.btnEndless.addEventListener('click', () => { Audio2.init(); Audio2.resume(); Game.start(true); });
    this.el.btnSound.addEventListener('click', () => {
      const muted = Audio2.toggleMute();
      this.el.btnSound.textContent = muted ? '🔇' : '🔊';
      this.el.btnSound.classList.toggle('off', muted);
    });

    // 暂停 / 返回菜单按钮
    this.el.btnResume.addEventListener('click', () => Game.togglePause());
    this.el.btnRestart.addEventListener('click', () => Game.start(Game.endless));
    this.el.btnMenu.addEventListener('click', () => Game.toMenu());
    this.el.btnMenuR.addEventListener('click', () => Game.toMenu());

    // 机型选择卡片（由 SHIPS 动态生成，含属性条）
    this.buildShipCards();
  },

  buildShipCards(){
    const wrap = document.getElementById('shipCards');
    if (!wrap || typeof SHIPS === 'undefined') return;
    const sm = { hp:[1e9,0], spd:[1e9,0], fire:[1e9,0] };
    SHIPS.forEach(s => { for (const k in sm){ sm[k][0]=Math.min(sm[k][0],s[k]); sm[k][1]=Math.max(sm[k][1],s[k]); } });
    const norm = (v,k) => sm[k][1]>sm[k][0] ? Math.round((v-sm[k][0])/(sm[k][1]-sm[k][0])*100) : 100;
    const hex = (h) => '#' + ('000000'+h.toString(16)).slice(-6);
    wrap.innerHTML = '';
    SHIPS.forEach((s, i) => {
      const c = hex(s.color);
      const card = document.createElement('div');
      card.className = 'ship-card' + (i === Game.shipIdx ? ' sel' : '');
      card.dataset.idx = i;
      const bar = (lab, key) =>
        '<div class="stat"><span>'+lab+'</span><span class="v">'+norm(s[key],key)+'</span></div>' +
        '<div class="bar"><i style="width:'+norm(s[key],key)+'%;background:'+c+'"></i></div>';
      const wName = (typeof Progress !== 'undefined' && Progress.W_INFO[s.startWeapon])
        ? Progress.W_INFO[s.startWeapon].name : (s.startWeapon || '—');
      const traitTxt = s.trait || (s.talent ? s.talent : '无天赋');
      card.innerHTML =
        '<canvas class="shipPrev" width="200" height="160"></canvas>' +
        '<div class="shipHead"><span class="sw" style="color:'+c+';background:'+c+'"></span><b>'+s.name+'</b></div>' +
        '<span class="sdesc">'+s.desc+'</span>' +
        bar('装甲','hp') + bar('速度','spd') + bar('射速','fire') +
        '<div class="tags">' +
          '<span class="tag tal">天赋 · '+traitTxt+'</span>' +
          '<span class="tag wp">初始武器 · '+wName+'</span>' +
        '</div>';
      card.addEventListener('click', () => {
        Game.shipIdx = i;
        this.shipCards.forEach(x => x.classList.toggle('sel', x === card));
      });
      wrap.appendChild(card);
    });
    this.shipCards = Array.from(wrap.children);
    this.shipCanvases = this.shipCards.map(c => c.querySelector('.shipPrev'));
    this.shipCtxs = this.shipCanvases.map(c => c ? c.getContext('2d') : null);
  },

  /* ---- 战机选择界面：用单一离屏渲染器把每架飞机画进卡片 canvas ---- */
  initPreview(){
    if (this._pv) return this._pv;
    const W = 200, H = 160, TARGET = 1.9;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    cam.position.set(3.2, 1.9, 5.4); cam.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0x9fb6d0, 0.55));
    const key = new THREE.DirectionalLight(0xcfeaff, 1.6); key.position.set(4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff5c93, 0.6); rim.position.set(-5, 2, -4); scene.add(rim);
    const fill = new THREE.DirectionalLight(0x38f0ff, 0.5); fill.position.set(0, -3, 2); scene.add(fill);
    const pivot = new THREE.Group(); scene.add(pivot);
    // 每架飞机建模 → 居中缩放到统一画幅，保证不同机型都框得下
    const holders = SHIPS.map(s => {
      const g = Gfx.ship(s.model, s.color, 1.0).g;
      const box = new THREE.Box3().setFromObject(g);
      const ctr = new THREE.Vector3(); box.getCenter(ctr);
      const sz = new THREE.Vector3(); box.getSize(sz);
      const max = Math.max(sz.x, sz.y, sz.z) || 1;
      g.position.sub(ctr);
      const holder = new THREE.Group();
      holder.add(g);
      holder.scale.setScalar(TARGET / max);
      return holder;
    });
    this._pv = { renderer, scene, cam, pivot, holders, W, H };
    return this._pv;
  },

  renderPreviews(now){
    if (!this.shipCanvases || !this.shipCanvases.length) return;
    const pv = this.initPreview();
    const ang = (now || 0) * 0.0005;
    pv.pivot.rotation.set(0.26, ang, 0);
    for (let i = 0; i < this.shipCanvases.length; i++){
      const cv = this.shipCanvases[i], ctx = this.shipCtxs && this.shipCtxs[i];
      if (!cv || !ctx) continue;
      while (pv.pivot.children.length) pv.pivot.remove(pv.pivot.children[0]);
      pv.pivot.add(pv.holders[i]);
      pv.renderer.render(pv.scene, pv.cam);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(pv.renderer.domElement, 0, 0, cv.width, cv.height);
    }
  },

  update(){
    const e = this.el;
    // 经验
    const pct = Util.clamp(Progress.exp / Progress.need * 100, 0, 100);
    e.xpBar.style.width = pct + '%';
    e.xpTxt.textContent = 'LV.' + Progress.level + '　' +
      Math.floor(Progress.exp) + ' / ' + Progress.need;
    // 生命
    const hp = Util.clamp(Player.hp / Player.maxHp * 100, 0, 100);
    e.hpBar.style.width = hp + '%';
    e.hpTxt.textContent = Math.ceil(Player.hp) + ' / ' + Math.round(Player.maxHp);
    // 状态
    e.wave.textContent = Game.wave;
    if (e.sector){ e.sector.textContent = Game.stageName; e.sector.style.color = Game.stageAccent; }
    e.time.textContent = Util.fmtTime(Game.time);
    e.kill.textContent = Game.kills;
    const el = Math.max(1, Game.time);
    e.dps.textContent = Math.round(Game.dmgDealt / el);
  },

  setFps(v){ this.el.fps.textContent = Math.round(v); },

  renderGear(){
    const g = this.el.gear;
    g.innerHTML = '';
    const mk = (cls, icon, name, lv, max) => {
      const d = document.createElement('div');
      d.className = 'gi ' + cls + (lv >= max ? ' max' : '');
      d.innerHTML = '<span>' + icon + '</span><span>' + name + '</span>' +
        '<span class="lv">' + (lv >= max ? 'MAX' : 'L' + lv) + '</span>';
      g.appendChild(d);
    };
    for (const k in Progress.weapons){
      if (!Progress.weapons[k]) continue;
      mk('w', Progress.W_INFO[k].icon, Progress.W_INFO[k].name, Progress.weapons[k], 5);
    }
    for (const k in Wingmen.SPEC){
      const c = Wingmen.count(k);
      if (c) mk('g', Progress.G_INFO[k].icon, Progress.G_INFO[k].name, c, 3);
    }
    for (const k in Progress.passives){
      if (!Progress.passives[k]) continue;
      mk('p', Progress.P_INFO[k].icon, Progress.P_INFO[k].name, Progress.passives[k], 5);
    }
    // 共鸣条：装备栏底部显示已激活的流派阶梯
    const sy = Synergy.activeList();
    if (sy.length){
      const bar = document.createElement('div');
      bar.className = 'gi syn';
      bar.style.cssText = 'width:100%;margin-top:4px;display:flex;gap:8px;flex-wrap:wrap;font-size:11px';
      bar.innerHTML = sy.map(t => '<span style="color:' + t.color + '">' + t.name + '·' + t.tier + '阶</span>').join('');
      g.appendChild(bar);
    }
  },

  toast(a, b, color, dur){
    const e = this.el;
    e.toastA.textContent = a;
    e.toastB.textContent = b || '';
    e.toastA.style.color = color || '#38f0ff';
    e.toast.style.opacity = '1';
    this.toastT = dur || 1.6;
  },

  waveBanner(w){
    const e = this.el;
    e.wbNum.textContent = 'WAVE ' + w;
    e.wbTxt.textContent = '第 ' + w + ' 波';
    e.waveBanner.classList.remove('hide', 'show');
    void e.waveBanner.offsetWidth;          // 强制回流以重启动画
    e.waveBanner.classList.add('show');
  },

  /** 星域（地图）切换横幅：SECTOR I · 残骸星域 */
  sectorBanner(idx, name, sub){
    const e = this.el;
    const RN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
    e.sbNum.textContent = 'SECTOR ' + (RN[idx] || (idx + 1)) + ' · ' + sub;
    e.sbTxt.textContent = name;
    e.sectorBanner.classList.remove('hide', 'show');
    void e.sectorBanner.offsetWidth;
    e.sectorBanner.classList.add('show');
  },

  updateToast(dt){
    if (this.toastT > 0){
      this.toastT -= dt;
      if (this.toastT <= 0) this.el.toast.style.opacity = '0';
    }
  },

  flashHit(){
    const f = this.el.hitFlash;
    f.style.opacity = '1';
    clearTimeout(this._ft);
    this._ft = setTimeout(() => { f.style.opacity = '0'; }, 110);
  },

  showBoss(on){ this.el.bossBar.classList.toggle('hide', !on); },
  setBoss(ratio){ this.el.bossFill.style.width = Util.clamp(ratio * 100, 0, 100) + '%'; },

  showLevelUp(cards){
    const e = this.el;
    e.luLv.textContent = 'LV.' + Progress.level;
    e.cards.innerHTML = '';
    cards.forEach((c, i) => {
      const d = document.createElement('div');
      d.className = 'card t-' + c.type;
      d.innerHTML =
        '<div class="tag">' + c.tag + '</div>' +
        '<div class="ic">' + c.icon + '</div>' +
        '<div class="nm">' + c.name + '</div>' +
        '<div class="lvl">' + c.lvTxt + '</div>' +
        '<div class="ds">' + c.desc + '</div>' +
        '<div class="df">' + c.diff + '</div>' +
        (c.tags && c.tags.length ? '<div class="tags" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">' +
          c.tags.map(t => '<span class="tg" style="font-size:11px;opacity:.92;color:' + t.color + '">' +
            t.name + (t.tier ? '·' + t.tier + '阶' : '') + (t.next ? ' (' + t.total + '/' + t.next + ')' : '') + '</span>').join('') +
          '</div>' : '') +
        '<div class="key">' + (i + 1) + '</div>';
      d.addEventListener('click', () => Game.pickCard(i));
      e.cards.appendChild(d);
    });
    e.levelup.classList.remove('hide');
  },

  hideLevelUp(){ this.el.levelup.classList.add('hide'); },

  showMenu(){
    const e = this.el;
    e.sKick.textContent = 'SURVIVE THE VOID';
    e.sTitle.textContent = '星陨幸存者';
    e.sSub.textContent = 'STELLAR SURVIVORS';
    e.sStats.classList.add('hide');
    e.howto.classList.remove('hide');
    e.shipRow.classList.remove('hide');
    e.btnMenuR.classList.add('hide');
    e.btnStart.textContent = '开始任务';
    e.overlay.classList.remove('hide');
    if (typeof World !== 'undefined' && World.renderer){
      const gl = World.renderer.domElement;
      if (gl.parentNode) gl.parentNode.removeChild(gl);
    }
  },

  showResult(win){
    const e = this.el;
    e.sKick.textContent = win ? 'MISSION COMPLETE' : 'SHIP DESTROYED';
    e.sTitle.textContent = win ? '任务达成' : '舰船损毁';
    e.sTitle.style.background = win
      ? 'linear-gradient(180deg,#ffffff,#ffcc33 55%,#c98a10)'
      : 'linear-gradient(180deg,#ffffff,#ff3d7f 55%,#8a1038)';
    e.sTitle.style.webkitBackgroundClip = 'text';
    e.sSub.textContent = win ? '深渊母舰已被击毁' : '你的残骸漂向深空…';
    e.rTime.textContent = Util.fmtTime(Game.time);
    e.rKill.textContent = Game.kills;
    e.rLv.textContent = Progress.level;
    e.rWave.textContent = Game.wave;
    e.rDps.textContent = Math.round(Game.dmgDealt / Math.max(1, Game.time));
    e.sStats.classList.remove('hide');
    e.howto.classList.add('hide');
    e.shipRow.classList.add('hide');
    e.btnStart.textContent = '再来一次';
    e.btnEndless.classList.toggle('hide', !win);
    e.btnMenuR.classList.remove('hide');
    e.overlay.classList.remove('hide');
  },

  hideOverlay(){ this.el.overlay.classList.add('hide'); },
};

/* ============================ Game 主控 ============================ */
const Game = {
  state: 'MENU',
  time: 0, wave: 1, kills: 0, dmgDealt: 0,
  endless: false, bossSpawned: false, bossRound: 0,
  shipIdx: 0,
  stageIdx: 0, stageName: '', stageAccent: '#38f0ff', stageTint: null,
  spawnCd: 0, last: 0, fpsT: 0, fpsN: 0,
  _raf: null,

  init(){
    World.init();
    Input.init();
    FX.init();
    Bullets.init();
    Enemies.init();
    Loot.init();
    Weapons.init();
    Wingmen.init();
    Player.init();
    Boss.init();
    Asteroids.init();
    Minimap.init();
    HUD.init();

    HUD.showMenu();
    document.getElementById('boot').classList.add('hide');

    this.last = performance.now();
    const loop = (t) => { this._raf = requestAnimationFrame(loop); this.frame(t); };
    this._raf = requestAnimationFrame(loop);
  },

  /* ---------------- 开局 / 重开 ---------------- */
  start(endless){
    this.endless = !!endless;
    this.time = 0; this.wave = 1; this.kills = 0; this.dmgDealt = 0;
    this.bossSpawned = false; this.bossRound = 0;
    this._waveCache = {};                  // 清空难度曲线缓存（endless 可能随局变化）
    this.spawnCd = 1.2;

    Enemies.clear();
    Bullets.reset();
    Loot.clear();
    FX.reset();
    Wingmen.clear();
    Boss.clear();
    Weapons.reset();
    // 先定机型，再让 Progress 依机型天赋/初始武器初始化（顺序很关键）
    Player.setShip(this.shipIdx);
    Player.reset();
    Progress.reset();
    Asteroids.reset();
    Asteroids.scatter(14);
    Player.inv = 1.6;                    // 开局短暂无敌

    World.camX = 0; World.camZ = 0;
    HUD.hideLevelUp();
    HUD.hideOverlay();
    HUD.renderGear();
    HUD.el.btnEndless.classList.add('hide');
    HUD.el.pause.classList.add('hide');

    this.state = 'PLAYING';
    if (typeof World !== 'undefined' && World.renderer){
      const gl = World.renderer.domElement;
      if (!gl.parentNode) document.body.insertBefore(gl, document.body.firstChild);
      gl.style.display = 'block';
    }
    Audio2.startMusic();
    HUD.el.btnSound.textContent = Audio2.muted ? '🔇' : '🔊';
    HUD.el.btnSound.classList.toggle('off', Audio2.muted);
    this.applyStage(0, true);
  },

  over(win){
    if (this.state === 'GAMEOVER') return;
    this.state = 'GAMEOVER';
    Audio2.stopMusic();
    HUD.hideLevelUp();
    if (win){ Audio2.win(); HUD.toast('任务达成', '', '#ffcc33', 2); }
    else {
      Audio2.lose();
      FX.explode(Player.x, Player.z, 0x38f0ff, 2.4);
      World.shake(3, 1);
      Player.group.visible = false;
    }
    // 留一个短促的"演出停顿"，但必须远小于自检等待窗口（胜利 800ms / 阵亡 600ms）
    setTimeout(() => HUD.showResult(win), win ? 380 : 300);
  },

  togglePause(){
    if (this.state === 'PLAYING'){ this.state = 'PAUSED'; HUD.el.pause.classList.remove('hide'); }
    else if (this.state === 'PAUSED'){ this.state = 'PLAYING'; HUD.el.pause.classList.add('hide'); }
  },

  /** 从暂停或结算返回主菜单 */
  toMenu(){
    this.state = 'MENU';
    Audio2.stopMusic();
    HUD.hideLevelUp();
    HUD.showBoss(false);
    HUD.el.pause.classList.add('hide');
    if (Player.group) Player.group.visible = true;
    HUD.showMenu();
  },

  /* ---------------- 升级选卡 ---------------- */
  openLevelUp(){
    if (this.state !== 'PLAYING') return;
    this.state = 'LEVELUP';
    Progress.roll();
    HUD.showLevelUp(Progress.cards);
    Audio2.levelup();
  },

  pickCard(i){
    if (this.state !== 'LEVELUP') return;
    const c = Progress.cards[i];
    Progress.applyCard(c);
    Progress.pending = Math.max(0, Progress.pending - 1);
    if (Progress.pending > 0){
      Progress.roll();
      HUD.showLevelUp(Progress.cards);
    } else {
      HUD.hideLevelUp();
      this.state = 'PLAYING';
    }
  },

  /* ---------------- 星域（地图）切换 ---------------- */
  stageOf(w){
    if (this.endless) return Math.floor((w - 1) / 2) % STAGES.length;
    return Math.min(STAGES.length - 1, Math.floor((w - 1) / 2));
  },

  applyStage(idx, announce){
    const st = STAGES[idx];
    if (!st) return;
    this.stageIdx = idx;
    this.stageName = st.name;
    this.stageAccent = st.accent;
    this.stageTint = st.tint;
    if (World.applyTheme) World.applyTheme(st.bg, st.fog);
    if (Asteroids.retheme) Asteroids.retheme(st.aster);
    if (Minimap.setAccent) Minimap.setAccent(st.accent);
    if (HUD.el.sector){ HUD.el.sector.textContent = st.name; HUD.el.sector.style.color = st.accent; }
    if (announce){
      HUD.sectorBanner(idx, st.name, st.sub);
      HUD.toast('进入 ' + st.name, st.sub, st.accent, 2.0);
      Audio2.tone(Util.pick([330, 392, 440]), 0.4, 'triangle', 0.14, 520);
    }
  },

  /* ---------------- 刷怪导演 ---------------- */
  /** 难度曲线：多项式 + 后期指数阻尼 + 内存安全上限（替代旧纯线性） */
  hpMulAt(w){
    if (!this._waveCache) this._waveCache = {};
    if (this._waveCache['h' + w] != null) return this._waveCache['h' + w];
    const poly = 1 + 0.063 * Math.pow(w, 1.8);                 // w=10 与旧线性 (≈4.96) 对齐
    const expo = w > 12 ? Math.exp(Math.min(3.2, (w - 12) * 0.12)) : 1;  // 后期指数阻尼，防上溢
    const v = Math.min(900, poly * expo) * (this.endless ? 1.35 : 1);
    this._waveCache['h' + w] = v;
    return v;
  },

  waveSpec(w){
    if (!this._waveCache) this._waveCache = {};
    if (this._waveCache[w]) return this._waveCache[w];          // 按波次缓存，去掉每帧重算
    const kinds = STAGES[this.stageOf(w)].pool;
    const g = this.endless ? 1.35 : 1;                         // 无尽模式成长更陡
    const spec = {
      kinds,
      interval: Math.max(0.15, (0.95 - w * 0.065) / g),
      per: 1 + Math.floor(w / 2.5),
      hpMul: this.hpMulAt(w),
      spdMul: this.endless ? Math.min(2.2, 1 + (w - 1) * 0.06) : Math.min(1.7, 1 + (w - 1) * 0.045),
      elite: w >= 3 ? Math.min(0.25, 0.02 + w * 0.008) : 0,
      cap: Math.min(180, 42 + w * 13),
    };
    this._waveCache[w] = spec;
    return spec;
  },

  spawnRing(){
    // 玩家周围环形，尽量落在场内
    for (let i = 0; i < 8; i++){
      const a = Math.random() * Util.TAU, r = Util.rand(31, 43);
      const x = Player.x + Math.cos(a) * r, z = Player.z + Math.sin(a) * r;
      if (Math.hypot(x, z) < CFG.arena - 2) return { x, z };
    }
    const a = Math.random() * Util.TAU;
    return { x: Math.cos(a) * (CFG.arena - 6), z: Math.sin(a) * (CFG.arena - 6) };
  },

  director(dt){
    const S = this.waveSpec(this.wave);
    Enemies._curTint = this.stageTint || null;
    this.spawnCd -= dt;
    if (this.spawnCd > 0) return;
    this.spawnCd = S.interval;
    if (Enemies.pool.count >= S.cap) return;
    // BOSS 战期间减压
    const per = Boss.active ? Math.max(1, Math.floor(S.per * 0.4)) : S.per;
    for (let i = 0; i < per; i++){
      const p = this.spawnRing();
      const kinds = (this.wave > 15) ? S.kinds.concat(['phaser','turret','sniper']) : S.kinds;
      const kind = Util.pick(kinds);
      const elite = Math.random() < S.elite;
      if (kind === 'wasp'){
        // 蜂群：一次吐一小簇，制造数量压力（精英只单只，避免过强）
        const n = 3 + (this.wave >= 6 ? 1 : 0);
        for (let k = 0; k < n; k++)
          Enemies.spawn('wasp', p.x + Util.rand(-2.6, 2.6), p.z + Util.rand(-2.6, 2.6),
            S.hpMul, S.spdMul, 1, false, this.stageTint);
      } else {
        Enemies.spawn(kind, p.x, p.z, S.hpMul, S.spdMul, 1, elite, this.stageTint);
      }
    }
  },

  /* ---------------- 帧循环 ---------------- */
  frame(now){
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.05, raw);            // 防止切后台后的巨大步长

    // FPS
    this.fpsN++; this.fpsT += raw;
    if (this.fpsT >= 0.5){ HUD.setFps(this.fpsN / this.fpsT); this.fpsT = 0; this.fpsN = 0; }

    // 主菜单：把每架飞机的 3D 造型实时渲染进选择卡片
    if (this.state === 'MENU') HUD.renderPreviews(now);

    if (this.state === 'PLAYING'){
      this.time += dt;

      // 波次推进（由时间驱动，便于外部调 time 快进）
      const w = Math.floor(this.time / CFG.waveSec) + 1;
      if (w !== this.wave){
        const up = w > this.wave;
        this.wave = w;
        if (up){
          HUD.waveBanner(w);
          HUD.toast('敌军强度提升', 'WAVE ' + w, '#ffcc33', 1.1);
          Audio2.tone(330, 0.3, 'triangle', 0.14, 520);
          const stNow = this.stageOf(w);
          if (stNow !== this.stageIdx) this.applyStage(stNow, true);
          // 每波开始来一发小额补给
          if (w % 3 === 0) Loot.dropHeal(Player.x + Util.rand(-6, 6), Player.z + Util.rand(-6, 6));
        }
      }

      // BOSS 触发
      const bossAt = CFG.bossWave * CFG.waveSec * (this.bossRound + 1);
      if (!Boss.active && !this.bossSpawned && this.time >= bossAt){
        this.bossSpawned = true;
        Boss.spawn(this.bossRound);            // 传入轮次 → 无尽模式逐轮强化
      }

      Input.update();
      Player.update(dt);
      Weapons.update(dt);
      Wingmen.update(dt);
      Enemies.update(dt);
      Boss.update(dt);
      Bullets.update(dt);
      Loot.update(dt);
      Asteroids.update(dt);
      this.director(dt);
    }

    // 特效/相机/UI 始终推进，暂停时画面也不僵死
    FX.update(dt);
    HUD.updateToast(dt);
    World.updateCamera(dt, Player.x, Player.z);
    World.ambT += dt;                                  // 环境动画时钟（菜单也在走）
    if (World.stars) World.stars.rotation.y += dt * 0.004;
    if (World.stars) World.stars.material.opacity = 0.78 + 0.16 * Math.sin(World.ambT * 0.6);
    if (World.starBright) World.starBright.material.opacity = 0.45 + 0.35 * Math.sin(World.ambT * 1.1 + 1.3);
    if (World.border) World.border.rotation.y += dt * 0.02;
    if (World.borderPulse) World.borderPulse.material.opacity = 0.22 + 0.22 * Math.sin(World.ambT * 1.7);
    if (World.nebula){ World.nebula.forEach((n, i) => {
      n.position.x += Math.sin(World.ambT * 0.05 + i) * 0.02;
      n.rotation.z += dt * 0.01;
      n.material.opacity = n.userData.bop * (0.78 + 0.22 * Math.sin(World.ambT * 0.3 + i * 1.3));
    }); }
    if (World.scan) World.scan.rotation.z += dt * 0.5;
    if (World.comets) World.comets.forEach(c => {
      const u = c.userData; u.a += u.sp * dt;
      c.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r);
      c.lookAt(0, u.y, 0);
      c.material.opacity = 0.3 + 0.22 * (0.5 + 0.5 * Math.sin(World.ambT * 1.3 + u.a * 2));
    });
    Minimap.render();
    HUD.update();

    World.renderer.render(World.scene, World.camera);
  },

  /** 无尽模式下击破 BOSS 后进入下一轮 */
  nextBossRound(){
    this.bossRound++;
    this.bossSpawned = false;
  },
};

/* ============================ 启动 ============================ */
function boot(){
  if (typeof THREE === 'undefined'){
    document.getElementById('boot').textContent = 'three.js 加载失败 · 请检查网络后刷新';
    return;
  }
  try {
    Game.init();
  } catch (err){
    document.getElementById('boot').classList.remove('hide');
    document.getElementById('boot').textContent = '初始化失败：' + err.message;
    throw err;
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
