
/* ============================ World 场景 ============================ */
const World = {
  scene: null, camera: null, renderer: null,
  shakeT: 0, shakeP: 0,
  camX: 0, camZ: 0, ambT: 0,   // ambT：始终累加的环境动画时钟（菜单/暂停时也让背景活着）

  init(){
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x05070f);
    sc.fog = new THREE.Fog(0x05070f, 62, 128);

    this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.5, 400);
    this.camera.position.set(0, CFG.camH, CFG.camBack);
    this.camera.lookAt(0, 0, 0);

    const r = this.renderer = new THREE.WebGLRenderer({
      antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.setSize(innerWidth, innerHeight);
    r.domElement.id = 'gl';
    document.body.insertBefore(r.domElement, document.body.firstChild);

    /* ---- 光照：暗色宇宙基调，敌人靠自发光显色（原版配置：对比度高、颜色鲜明）---- */
    sc.add(new THREE.AmbientLight(0x4a6a95, 1.15));
    const key = new THREE.DirectionalLight(0xbfe6ff, 1.5);
    key.position.set(24, 52, 18); sc.add(key);
    const rim = new THREE.DirectionalLight(0xff5c93, 0.55);
    rim.position.set(-30, 18, -26); sc.add(rim);
    // 跟随玩家的点光，给近处单位打亮，突出"主角光环"
    this.playerLight = new THREE.PointLight(0x38f0ff, 90, 34, 2);
    this.playerLight.position.set(0, 7, 0); sc.add(this.playerLight);

    this.buildGround();
    this.buildStars();
    this.buildNebula();
    this.buildBorder();
    this.buildComets();

    addEventListener('resize', () => this.resize());
  },

  buildGround(){
    // 主网格
    const g1 = new THREE.GridHelper(CFG.arena * 2.4, 60, 0x1c5f78, 0x0e3244);
    g1.material.transparent = true; g1.material.opacity = 0.55;
    g1.position.y = 0;
    this.scene.add(g1);
    g1.material.vertexColors = false; g1.material.needsUpdate = true; this.grid1 = g1;  // 关闭顶点色→纯 accent 染色，强化星域辨识
    // 细网格
    const g2 = new THREE.GridHelper(CFG.arena * 2.4, 180, 0x0a2634, 0x0a2634);
    g2.material.transparent = true; g2.material.opacity = 0.24;
    g2.position.y = -0.02;
    this.scene.add(g2);
    g2.material.vertexColors = false; g2.material.needsUpdate = true; this.grid2 = g2;
    // 暗色地板（让贴地发光片有底）
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(CFG.arena * 1.35, 64),
      new THREE.MeshBasicMaterial({ color: 0x040810 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05;
    this.scene.add(floor);
    // 中心辉光晕（加法混合，给战场一点纵深与氛围，边缘自然淡出）
    const fg = new THREE.Mesh(
      new THREE.CircleGeometry(CFG.arena * 1.15, 64),
      new THREE.MeshBasicMaterial({ color: 0x0c2a3e, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    fg.rotation.x = -Math.PI / 2; fg.position.y = -0.04;
    this.scene.add(fg); this.floorGlow = fg;
    // 地面扫描波：缓慢旋转的扇形扫掠，强化"战场雷达"氛围（fog:false 保证可见）
    const sweep = new THREE.Mesh(
      new THREE.CircleGeometry(CFG.arena * 1.2, 60, 0, 0.55),
      new THREE.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.07,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    sweep.rotation.x = -Math.PI / 2; sweep.position.y = 0.02;
    this.scene.add(sweep); this.scan = sweep;
  },

  buildStars(){
    const N = 1700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++){
      const r = Util.rand(90, 300), a = Math.random() * Util.TAU;
      pos[i*3]   = Math.cos(a) * r;
      pos[i*3+1] = Util.rand(-40, 140);
      pos[i*3+2] = Math.sin(a) * r;
      c.setHSL(Util.rand(0.5, 0.66), Util.rand(0.3, 0.9), Util.rand(0.45, 0.98));
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({
      size: 1.6, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
    this.scene.add(this.stars);
    // 稀疏亮星层（更大更亮，用于闪烁），fog:false 保证不被雾吃掉
    const N2 = 260, p2 = new Float32Array(N2 * 3);
    for (let i = 0; i < N2; i++){
      const r = Util.rand(120, 320), a = Math.random() * Util.TAU;
      p2[i*3] = Math.cos(a) * r; p2[i*3+1] = Util.rand(-30, 150); p2[i*3+2] = Math.sin(a) * r;
    }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(p2, 3));
    this.starBright = new THREE.Points(g2, new THREE.PointsMaterial({
      size: 3.4, color: 0xbfe6ff, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
    this.scene.add(this.starBright);
  },

  /** 星云：5 片大型加法混合云，缓慢漂移 + 呼吸脉冲，制造视差纵深。
   *  注意 fog:false —— 否则会被场景雾按距离吞掉，背景变死黑。*/
  buildNebula(){
    const mk = (r, gg, b, sz, x, y, z, op) => {
      const cvs = document.createElement('canvas'); cvs.width = cvs.height = 256;
      const g = cvs.getContext('2d');
      const grd = g.createRadialGradient(128, 128, 8, 128, 128, 124);
      grd.addColorStop(0,   `rgba(${r},${gg},${b},${op})`);
      grd.addColorStop(0.5, `rgba(${r},${gg},${b},${op * 0.5})`);
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(cvs);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.position.set(x, y, z);
      m.userData.bop = op;
      this.scene.add(m);
      return m;
    };
    this.nebula = [
      mk(110,  60, 200, 175,  -70, 34, -130, 0.50),  // 紫
      mk( 30, 110, 175, 145,   90, 22, -100, 0.46),  // 蓝
      mk(190,  55, 120, 125,   35, 60, -160, 0.42),  // 粉
      mk( 40, 170, 180, 105, -110, 46, -110, 0.40),  // 青
      mk(150,  70, 220,  95,  120, 30, -175, 0.38),  //  Violet
    ];
  },

  buildBorder(){
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(CFG.arena, 0.34, 6, 128),
      new THREE.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.4 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    // 能量护盾脉冲环（内侧，加法发光，帧循环里呼吸闪烁）
    const pulse = new THREE.Mesh(
      new THREE.TorusGeometry(CFG.arena - 0.45, 0.55, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0x38f0ff, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pulse.rotation.x = Math.PI / 2;
    g.add(pulse); this.borderPulse = pulse;
    // 边界立柱
    for (let i = 0; i < 48; i++){
      const a = i / 48 * Util.TAU;
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 4.5, 0.4),
        new THREE.MeshBasicMaterial({ color: 0x155f7a, transparent: true, opacity: 0.55 }));
      p.position.set(Math.cos(a) * CFG.arena, 2.2, Math.sin(a) * CFG.arena);
      g.add(p);
    }
    this.border = g;
    this.borderRing = ring; this.borderPulse = pulse;
    this.borderCols = g.children.filter(c => c !== ring && c !== pulse);
    this.scene.add(g);
  },

  shake(power, time){
    this.shakeP = Math.max(this.shakeP, power);
    this.shakeT = Math.max(this.shakeT, time || 0.22);
  },

  /** 背景彗星流：远景几条加法混合的拖尾，缓慢公转 + 呼吸明灭，给太空纵深 */
  buildComets(){
    const cvs = document.createElement('canvas'); cvs.width = 16; cvs.height = 64;
    const g = cvs.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 64);   // 头亮尾淡
    grd.addColorStop(0,   'rgba(170,225,255,0)');
    grd.addColorStop(0.7, 'rgba(150,220,255,0.5)');
    grd.addColorStop(1,   'rgba(255,255,255,0.95)');
    g.fillStyle = grd; g.fillRect(0, 0, 16, 64);
    const tex = new THREE.CanvasTexture(cvs);
    this.comets = [];
    for (let i = 0; i < 6; i++){
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 9),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      const r = Util.rand(150, 300), a = Math.random() * Util.TAU;
      m.position.set(Math.cos(a) * r, Util.rand(-10, 60), Math.sin(a) * r);
      m.userData = { a, r, sp: Util.rand(0.02, 0.06) * (Math.random() < 0.5 ? 1 : -1), y: m.position.y };
      this.scene.add(m); this.comets.push(m);
    }
  },

  updateCamera(dt, tx, tz, zoom){
    zoom = zoom || 1;
    this.camX = Util.lerp(this.camX, tx, 1 - Math.pow(1 - CFG.camLerp, dt * 60));
    this.camZ = Util.lerp(this.camZ, tz, 1 - Math.pow(1 - CFG.camLerp, dt * 60));
    let ox = 0, oz = 0, oy = 0;
    if (this.shakeT > 0){
      this.shakeT -= dt;
      const k = this.shakeP * Math.max(0, this.shakeT / 0.22);
      ox = Util.rand(-k, k); oz = Util.rand(-k, k); oy = Util.rand(-k, k) * 0.5;
      if (this.shakeT <= 0) this.shakeP = 0;
    }
    this.camera.position.set(this.camX + ox, (CFG.camH + oy) * zoom, this.camZ + (CFG.camBack + oz) * zoom);
    this.camera.lookAt(this.camX + ox * 0.4, 0, this.camZ + oz * 0.4);
    this.playerLight.position.set(tx, 8, tz);
  },

  resize(){
    if (!this.renderer) return;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  },

  /** 按当前星域切换整体氛围：背景 + 雾色 + 网格/边界/星云/星空/主角光 全部随 accent 变化（地图风格核心） */
  applyTheme(st){
    if (!this.scene || !st) return;
    const accent = new THREE.Color(st.accent);
    if (this.scene.background && this.scene.background.setHex) this.scene.background.setHex(st.bg);
    if (this.scene.fog && this.scene.fog.color) this.scene.fog.color.setHex(st.fog);
    if (this.floorGlow) this.floorGlow.material.color.copy(accent).multiplyScalar(0.25).addScalar(0.02);
    if (this.grid1) this.grid1.material.color.copy(accent).multiplyScalar(0.55);
    if (this.grid2) this.grid2.material.color.copy(accent).multiplyScalar(0.32);
    if (this.borderRing)  this.borderRing.material.color.copy(accent);
    if (this.borderPulse) this.borderPulse.material.color.copy(accent);
    if (this.borderCols) for (const c of this.borderCols) if (c.material && c.material.color) c.material.color.copy(accent).multiplyScalar(0.5);
    if (this.starBright) this.starBright.material.color.copy(accent).lerp(new THREE.Color(0xffffff), 0.4);
    if (this.playerLight) this.playerLight.color.copy(accent);
    if (this.nebula) for (const m of this.nebula) m.material.color.copy(accent);
  },

  /** 世界坐标 → 屏幕像素（伤害数字用） */
  _v: null,
  toScreen(x, y, z){
    if (!this._v) this._v = new THREE.Vector3();
    this._v.set(x, y, z).project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * innerWidth,
             y: (-this._v.y * 0.5 + 0.5) * innerHeight,
             vis: this._v.z < 1 };
  },
};

/* ============================ Input 输入 ============================ */
const Input = {
  keys: {}, ax: 0, az: 0, dashQueued: false, dashQueuedP2: false,
  capturing: null, _onRebind: null,
  init(){
    addEventListener('keydown', (e) => {
      // 重映射模式：捕获下一个按键（Esc 取消）
      if (this.capturing){
        const code = e.code;
        if (code !== 'Escape'){ Settings.binds[this.capturing] = code; Settings.save(); }
        const cb = this._onRebind; this.capturing = null; this._onRebind = null;
        if (cb) cb();
        e.preventDefault(); return;
      }
      if (this.keys[e.code]) return;
      this.keys[e.code] = true;
      const b = Settings.binds;
      if (e.code === b.dash){ this.dashQueued = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight'){ this.dashQueuedP2 = true; e.preventDefault(); }
      if (e.code === b.pause || e.code === 'Escape') Game.togglePause();
      if (e.code === b.form) Wingmen.cycleFormation();
      if (Game.state === 'LEVELUP'){
        if (e.code === 'Digit1') Game.pickCard(0);
        if (e.code === 'Digit2') Game.pickCard(1);
        if (e.code === 'Digit3') Game.pickCard(2);
      }
      if (e.code === 'Enter' && Game.state === 'GAMEOVER') Game.start(Game.endless, Game.hell);
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.capturing = null; this._onRebind = null; });
  },
  update(){
    const k = this.keys, b = Settings.binds;
    let x = 0, z = 0;
    if (k[b.left]  || k.ArrowLeft)  x -= 1;
    if (k[b.right] || k.ArrowRight) x += 1;
    if (k[b.up]    || k.ArrowUp)    z -= 1;
    if (k[b.down]  || k.ArrowDown)  z += 1;
    const l = Math.hypot(x, z);
    if (l > 0){ x /= l; z /= l; }
    this.ax = x; this.az = z;
  },
  consumeDash(){ const d = this.dashQueued; this.dashQueued = false; return d; },
  /** 双人：按玩家 id 取归一化移动向量（P1 单人=WASD；双人 P1=方向键、P2=WASD）*/
  move(id){
    const k = this.keys;
    let u, d, l, r;
    if (id === 2){
      u = Settings.binds2.up; d = Settings.binds2.down; l = Settings.binds2.left; r = Settings.binds2.right;
    } else if (Game.coop){
      u = 'ArrowUp'; d = 'ArrowDown'; l = 'ArrowLeft'; r = 'ArrowRight';
    } else {
      u = Settings.binds.up; d = Settings.binds.down; l = Settings.binds.left; r = Settings.binds.right;
    }
    let x = 0, z = 0;
    if (k[l]) x -= 1; if (k[r]) x += 1;
    if (k[u]) z -= 1; if (k[d]) z += 1;
    const len = Math.hypot(x, z);
    if (len > 0){ x /= len; z /= len; }
    return { ax: x, az: z };
  },
  /** 双人：按玩家 id 取本帧冲刺触发（各自独立队列）*/
  dash(id){
    if (id === 2){ const d = this.dashQueuedP2; this.dashQueuedP2 = false; return d; }
    const d = this.dashQueued; this.dashQueued = false; return d;
  },
  // 开始重映射某个动作；onDone 在捕获完成后回调（用于刷新 UI）
  rebind(action, onDone){ this.capturing = action; this._onRebind = onDone; },
};

/* ============================ 持久化设置 ============================ */
const Settings = {
  vol:   { master: 0.5, sfx: 0.9, music: 0.42 },
  binds: { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD', dash:'Space', form:'KeyF', pause:'KeyP' },
  binds2: { up:'KeyW', down:'KeyS', left:'KeyA', right:'KeyD', dash:'ShiftLeft' },  // 双人：P2 = WASD + 左Shift 冲刺
  load(){
    try {
      const s = JSON.parse(localStorage.getItem('sts_settings') || 'null');
      if (s){
        if (s.vol)   Object.assign(this.vol, s.vol);
        if (s.binds) Object.assign(this.binds, s.binds);
      }
    } catch (e){}
  },
  save(){
    try { localStorage.setItem('sts_settings', JSON.stringify({ vol: this.vol, binds: this.binds })); } catch (e){}
  },
};
Settings.load();

/* ============================ Audio 合成音效 ============================ */
/* 没有音频素材，用 WebAudio 现场合成。手感提升非常明显。*/
const Audio2 = {
  ctx: null, master: null, ok: false, muted: false,
  init(){
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._mg = Settings.vol.master;                  // 主音量目标
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this._mg;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();              // 音效总线
      this.sfxBus.gain.value = Settings.vol.sfx; this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();            // 背景音乐总线
      this.musicBus.gain.value = Settings.vol.music; this.musicBus.connect(this.master);
      // 预生成白噪声 buffer（鼓点 hi-hat / 爆炸质感复用）
      const n = Math.floor(this.ctx.sampleRate * 0.4);
      this._noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.ok = true;
    } catch (e){ this.ok = false; }
  },
  resume(){ if (this.ok && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  _env(node, t0, a, d, peak){
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g); g.connect(this.sfxBus);
    return g;
  },
  tone(freq, dur, type, vol, slideTo){
    if (!this.ok || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      this._env(o, t0, 0.004, dur, vol == null ? 0.2 : vol);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e){}
  },
  noise(dur, vol, hp){
    if (!this.ok || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const n = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = hp || 900;
      s.connect(f);
      this._env(f, t0, 0.005, dur, vol == null ? 0.25 : vol);
      s.start(t0);
    } catch (e){}
  },
  shoot(){ this.tone(Util.rand(680, 780), 0.05, 'square', 0.055, 240); },
  missile(){ this.noise(0.12, 0.1, 1200); this.tone(200, 0.16, 'sawtooth', 0.08, 620); },
  laser(){ this.tone(1500, 0.09, 'sawtooth', 0.06, 480); this.tone(2100, 0.05, 'sine', 0.03, 700); },
  hit(){ this.tone(Util.rand(320, 420), 0.045, 'square', 0.055, 180); this.noise(0.03, 0.06, 4000); },
  kill(){ this.noise(0.18, 0.18, 1600); this.tone(Util.rand(110, 140), 0.14, 'triangle', 0.1, 45); this.tone(820, 0.05, 'square', 0.04, 300); },
  boom(){ this.noise(0.45, 0.34, 700); this.tone(70, 0.4, 'sine', 0.2, 28); },
  gem(){ this.tone(Util.rand(900, 1150), 0.055, 'sine', 0.05, 1500); },
  levelup(){ [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.15), i * 72)); },
  hurt(){ this.tone(160, 0.2, 'sawtooth', 0.16, 55); this.noise(0.2, 0.14, 500); },
  dash(){ this.tone(340, 0.14, 'sine', 0.1, 900); },
  bossWarn(){ [110, 110, 146].forEach((f, i) => setTimeout(() => this.tone(f, 0.34, 'sawtooth', 0.2), i * 260)); },
  win(){ [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.18), i * 130)); },
  lose(){ [400, 330, 260, 180].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, 'sawtooth', 0.16), i * 170)); },

  // —— 武器专属开火音：贴合各自特点，不再全部复用 shoot ——
  cannonPulse(){ this.tone(Util.rand(540, 640), 0.07, 'square', 0.06, 180); },
  spreadShot(){ this.noise(0.1, 0.16, 2400); this.tone(Util.rand(360, 440), 0.06, 'square', 0.045, 150); },
  sawWhirl(){ this.tone(150, 0.14, 'sawtooth', 0.08, 240); this.tone(900, 0.05, 'square', 0.03, 1300); },
  chainZap(){ this.tone(Util.rand(1400, 1800), 0.05, 'square', 0.04, 600); this.noise(0.06, 0.1, 5200); },
  novaBurst(){ this.boom(); this.tone(220, 0.5, 'sawtooth', 0.08, 880); },
  droneBlip(){ this.tone(Util.rand(1100, 1300), 0.05, 'sine', 0.05, 1700); },

  // —— 三种新武器专属音 ——
  rail(){ this.tone(Util.rand(170, 230), 0.13, 'sawtooth', 0.08, 60); this.tone(Util.rand(900, 1250), 0.05, 'square', 0.03, 1900); },
  flame(){ this.noise(0.16, 0.12, 1700); this.tone(Util.rand(200, 300), 0.12, 'sawtooth', 0.05, 520); },
  pulse(){ this.tone(Util.rand(300, 380), 0.18, 'sine', 0.07, 760); this.tone(120, 0.22, 'sine', 0.05, 50); },

  // —— E 三种新武器专属音 ——
  radialShot(){ this.tone(Util.rand(520, 640), 0.06, 'square', 0.05, 240); this.noise(0.05, 0.1, 2000); },
  reflect(){ this.tone(Util.rand(900, 1200), 0.06, 'sine', 0.05, 1600); this.tone(Util.rand(1400, 1700), 0.04, 'square', 0.03, 2200); },
  lance(){ this.tone(Util.rand(200, 280), 0.12, 'sawtooth', 0.07, 70); this.tone(Util.rand(1100, 1400), 0.05, 'square', 0.03, 1900); },

  /* ===================== 背景音乐：实时合成的合成波循环 ===================== */
  // 4 小节循环，vi–IV–I–V（A 小调），每小节：低音根音 + 和弦琶音 + 旋律 + 鼓点
  mtof(m){ return 440 * Math.pow(2, (m - 69) / 12); },
  musicBars: [
    { bass: 45, arp: [57, 60, 64, 69], lead: [69, 72, 76] }, // Am
    { bass: 41, arp: [53, 57, 60, 65], lead: [65, 69, 72] }, // F
    { bass: 48, arp: [60, 64, 67, 72], lead: [72, 76, 79] }, // C
    { bass: 43, arp: [55, 59, 62, 67], lead: [67, 71, 74] }, // G
  ],
  music: { on: false, step: 0, nextT: 0, timer: null, bpm: 122 },
  startMusic(){
    if (!this.ok || this.music.on) return;
    this.music.on = true;
    this.music.step = 0;
    this.music.nextT = this.ctx.currentTime + 0.08;
    try { this.musicBus.gain.setTargetAtTime(this.muted ? 0 : Settings.vol.music, this.ctx.currentTime, 0.4); } catch (e){}
    this.music.timer = setInterval(() => this._sched(), 25);
  },
  stopMusic(){
    if (!this.music.on) return;
    this.music.on = false;
    if (this.music.timer) clearInterval(this.music.timer);
    this.music.timer = null;
    try { this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35); } catch (e){}
  },
  _sched(){
    if (!this.ok) return;
    this._updateMusic();
    const m = this.music, spb = 60 / m.bpm, sps = spb / 4;
    try {
      while (m.nextT < this.ctx.currentTime + 0.14){
        this._step(m.step, m.nextT);
        m.step = (m.step + 1) % 64;            // 4 小节 × 16 步
        m.nextT += sps;
      }
    } catch (e){}
  },
  // 自适应：综合「敌人密度 + 波次推进 + Boss + 残血」计算强度与速度
  _updateMusic(){
    let mi = 0;
    try {
      const ec = (typeof Enemies !== 'undefined' && Enemies.pool) ? (Enemies.pool.active.length || 0) : 0;
      mi += Math.min(1.6, ec / 38);                                   // 敌人密度
      const wv = (typeof Game !== 'undefined' && Game.wave) ? Game.wave : 1;
      mi += Math.min(0.5, (wv - 1) * 0.02);                            // 波次推进
      this._mboss = (typeof Boss !== 'undefined' && Boss.active);       // Boss 激昂
      if (this._mboss) mi = Math.max(mi, 2.2);
      this._mlow = Game.players.some(p => p.maxHp > 0 && (p.hp / p.maxHp) < 0.3); // 残血紧张（任一玩家）
    } catch (e){ this._mboss = false; this._mlow = false; }
    this._mi = mi;
    const wv = (typeof Game !== 'undefined' && Game.wave) ? Game.wave : 1;
    const target = (this._mboss ? 144 : 120) + Math.min(26, (wv - 1) * 0.9); // 波次 / Boss 平滑提速
    this.music.bpm += (target - this.music.bpm) * 0.04;
  },
  _step(step, t){
    if (this.muted) return;
    const bar = (step >> 4) & 3, s = step & 15, B = this.musicBars[bar];
    const intensity = this._mi || 0;
    if (s === 0 || s === 8) this._at(this.mtof(B.bass), t, 0.22, 'triangle', 0.16);
    else if (s === 6 || s === 14) this._at(this.mtof(B.bass + 12), t, 0.14, 'triangle', 0.12);
    if ((s & 1) === 0){ const note = B.arp[(s >> 1) % B.arp.length]; this._at(this.mtof(note + 12), t, 0.13, 'square', 0.05); }
    if (s === 0) this._at(this.mtof(B.lead[0]), t, 0.34, 'sawtooth', 0.05);
    else if (s === 6) this._at(this.mtof(B.lead[1]), t, 0.30, 'sawtooth', 0.045);
    else if (s === 10) this._at(this.mtof(B.lead[2]), t, 0.26, 'sawtooth', 0.04);
    // 高强度层：敌人多 / 波次高时叠 16 分琶音 + 高八度 lead
    if (intensity >= 1 && (s & 1) === 1){ const note = B.arp[s % B.arp.length]; this._at(this.mtof(note + 24), t, 0.08, 'square', 0.03); }
    if (intensity >= 2 && (s === 4 || s === 12)) this._at(this.mtof(B.lead[0] + 12), t, 0.18, 'sawtooth', 0.035);
    // Boss 低音脉冲 / 残血不祥低鸣（自适应情绪层）
    if (this._mboss && (s === 2 || s === 10)) this._at(this.mtof(B.bass - 12), t, 0.16, 'sawtooth', 0.05);
    if (this._mlow && (s === 0 || s === 8)) this._at(this.mtof(33), t, 0.7, 'sine', 0.05);
    // 和弦 pad 铺底：每小节开头铺一层根+五度+八度的长音垫（sawtooth 缓入缓出），氛围更厚
    if (s === 0) this._pad(B.bass, t, step, 0.05 + intensity * 0.02);
    if (s === 0 || s === 8) this._hat(t, 0.05 + intensity * 0.03);
    if (s === 0 || s === 4 || s === 8 || s === 12) this._kick(t);
    if ((s & 1) === 1) this._hat(t);
  },
  // 长音 pad：整小节持续，缓入缓出（区别于 _at 的短音）
  _pad(rootMidi, t, step, vol){
    const spb = 60 / this.music.bpm;
    const dur = spb * 2;                                 // 两小节长音垫
    const chord = [rootMidi, rootMidi + 7, rootMidi + 12]; // 根 + 五度 + 八度
    for (const m of chord){
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(this.mtof(m), t);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.25);
      g.gain.setValueAtTime(vol, t + dur - 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(this.musicBus);
      o.start(t); o.stop(t + dur + 0.05);
    }
  },
  _at(freq, t, dur, type, vol){
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.03);
  },
  _kick(t){
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + 0.18);
  },
  _hat(t, vol){
    const s = this.ctx.createBufferSource(); s.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol == null ? 0.06 : vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(this.musicBus);
    s.start(t); s.stop(t + 0.06);
  },
  /** 独立音量控制：实时写入对应总线（静音时主/音乐总线压到 0） */
  setMasterVol(v){
    Settings.vol.master = Math.max(0, Math.min(1, v));
    this._mg = Settings.vol.master;
    if (this.ctx){ try { this.master.gain.setTargetAtTime(this.muted ? 0 : Settings.vol.master, this.ctx.currentTime, 0.05); } catch (e){} }
  },
  setSfxVol(v){
    Settings.vol.sfx = Math.max(0, Math.min(1, v));
    if (this.ctx){ try { this.sfxBus.gain.setTargetAtTime(Settings.vol.sfx, this.ctx.currentTime, 0.05); } catch (e){} }
  },
  setMusicVol(v){
    Settings.vol.music = Math.max(0, Math.min(1, v));
    if (this.ctx){ try { this.musicBus.gain.setTargetAtTime(this.muted ? 0 : Settings.vol.music, this.ctx.currentTime, 0.05); } catch (e){} }
  },
  /** 一键静音：同时压住音乐与音效总线 */
  toggleMute(){
    if (!this.ctx) this.init();
    if (!this.ok) return this.muted;
    this.resume();
    this.muted = !this.muted;
    try {
      this.master.gain.setTargetAtTime(this.muted ? 0 : Settings.vol.master, this.ctx.currentTime, 0.05);
      this.musicBus.gain.setTargetAtTime(this.muted ? 0 : Settings.vol.music, this.ctx.currentTime, 0.05);
    } catch (e){}
    return this.muted;
  },

  frostZap(){ this.tone(Util.rand(1800, 2400), 0.05, 'square', 0.04, 700); this.noise(0.05, 0.1, 6000); },
  meteorWarn(){ this.tone(140, 0.18, 'sawtooth', 0.06, 90); },
  meteorFall(){ this.noise(0.18, 0.5, 800); this.tone(90, 0.3, 'sawtooth', 0.09, 60); },
  stormCrack(){ this.tone(Util.rand(1200, 1600), 0.06, 'square', 0.05, 500); this.noise(0.08, 0.2, 4000); },

  /* ===================== C② 新武器专属音 ===================== */
  blackhole(){ this.tone(Util.rand(60, 100), 0.5, 'sine', 0.12, 30); this.noise(0.3, 0.12, 320); },
  phase(){ this.tone(Util.rand(520, 720), 0.18, 'sine', 0.06, 1200); this.noise(0.1, 0.06, 4200); },
  photon(){ this.tone(Util.rand(1600, 2100), 0.05, 'square', 0.04, 850); this.noise(0.04, 0.08, 6200); },
  tractor(){ this.tone(Util.rand(120, 180), 0.12, 'sawtooth', 0.05, 60); this.tone(Util.rand(300, 420), 0.1, 'sine', 0.03, 200); },

  /* ===================== E+ 新武器专属音 ===================== */
  pulsarShot(){ this.tone(Util.rand(900, 1300), 0.12, 'square', 0.05, 1400); this.tone(Util.rand(200, 280), 0.18, 'sine', 0.04, 120); },
  siege(){ this.tone(80, 0.4, 'sawtooth', 0.10, 50); this.noise(0.2, 0.4, 500); },
  scatterShot(){ this.tone(Util.rand(1400, 1800), 0.04, 'square', 0.03, 900); this.noise(0.04, 0.06, 5000); },
  ionShot(){ this.tone(Util.rand(2000, 2600), 0.05, 'triangle', 0.04, 1300); this.noise(0.03, 0.05, 7000); },
  rotor(){ this.tone(Util.rand(900, 1200), 0.05, 'square', 0.03, 1400); },
  mine(){ this.noise(0.18, 0.3, 1200); this.tone(110, 0.3, 'sawtooth', 0.1, 60); },
  nano(){ this.tone(Util.rand(700, 1000), 0.12, 'sine', 0.05, 1400); this.tone(Util.rand(1100, 1500), 0.1, 'sine', 0.03, 1800); },
};

/* ============================ FX 特效 ============================ */
const FX = {
  pool: null, group: null,
  dmgNodes: [], dmgFree: [],

  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);

    const sharedGeo = new THREE.SphereGeometry(1, 6, 5);
    this.pool = Pool.create(520, () => {
      const m = new THREE.Mesh(sharedGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false;
      this.group.add(m);
      return { mesh: m, x:0, y:0, z:0, vx:0, vy:0, vz:0, life:0, max:1, s0:1, s1:0, drag:0 };
    });

    // 冲击波环（独立小池）
    const ringGeo = new THREE.RingGeometry(0.72, 1, 26);
    this.ringPool = Pool.create(24, () => {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.visible = false;
      this.group.add(m);
      return { mesh: m, life: 0, max: 1, r0: 1, r1: 6 };
    });

    this.dmgLayer = document.getElementById('dmgLayer');
  },

  particle(x, y, z, color, opt){
    const o = this.pool.get(); if (!o) return;
    const q = opt || {};
    o.x = x; o.y = y; o.z = z;
    o.vx = q.vx || 0; o.vy = q.vy || 0; o.vz = q.vz || 0;
    o.life = 0; o.max = q.life || 0.5;
    o.s0 = q.s0 || 0.4; o.s1 = q.s1 == null ? 0 : q.s1;
    o.drag = q.drag == null ? 2.4 : q.drag;
    o.mesh.material.color.setHex(color);
    o.mesh.material.opacity = 1;
    o.mesh.scale.setScalar(o.s0);
    o.mesh.position.set(x, y, z);
    o.mesh.visible = true;
  },

  burst(x, z, color, n, power, y){
    const yy = y == null ? 0.7 : y;
    for (let i = 0; i < n; i++){
      const a = Math.random() * Util.TAU, e = Util.rand(0.1, 1.1);
      const sp = Util.rand(0.35, 1) * power;
      this.particle(x, yy, z, color, {
        vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: e * sp * 0.5,
        life: Util.rand(0.28, 0.62), s0: Util.rand(0.22, 0.5), drag: 3.1 });
    }
  },

  /** 命中/受击火花：同色四溅 + 白色核心，统一打击感 */
  hitSpark(x, z, color, y){
    const yy = y == null ? 0.7 : y;
    this.burst(x, yy, color, 5, 4.2, yy);
    this.burst(x, yy, 0xffffff, 3, 3.4, yy);
  },

  ring(x, z, color, r1, life){
    const o = this.ringPool.get(); if (!o) return;
    o.life = 0; o.max = life || 0.42; o.r0 = 0.5; o.r1 = r1 || 6;
    o.mesh.position.set(x, 0.16, z);
    o.mesh.material.color.setHex(color);
    o.mesh.material.opacity = 0.85;
    o.mesh.scale.setScalar(o.r0);
    o.mesh.visible = true;
  },

  /** 医疗十字脉冲：四向 + 字扩散 + 中心微闪，强化"治疗"辨识 */
  cross(x, z, color){
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){
      this.particle(x, 0.6, z, color, { vx: ax * 5.2, vz: az * 5.2, vy: 0.5,
        life: 0.42, s0: 0.5, s1: 0, drag: 2 });
    }
    this.burst(x, 0.6, color, 4, 3, 0.6);
  },

  explode(x, z, color, scale){
    const s = scale || 1;
    this.burst(x, z, color, Math.round(14 * s), 9 * s);
    this.burst(x, z, 0xffffff, Math.round(5 * s), 6 * s);
    this.ring(x, z, color, 5.5 * s, 0.4);
  },

  /** 飘字伤害数字（DOM，比 3D 文字便宜） */
  dmgText(x, z, val, crit, color){
    if (this.dmgNodes.length > 26) return;              // 上限保护
    const p = World.toScreen(x, 1.4, z);
    if (!p.vis) return;
    let el = this.dmgFree.pop();
    if (!el){ el = document.createElement('div'); this.dmgLayer.appendChild(el); }
    el.className = 'dmg' + (crit ? ' crit' : '');
    el.textContent = crit ? Math.round(val) + '!' : Math.round(val);
    el.style.color = color || (crit ? '#ffcc33' : '#ffffff');
    el.style.display = 'block';
    const node = { el, x: p.x, y: p.y, vy: Util.rand(-46, -66), vx: Util.rand(-16, 16), t: 0 };
    this.dmgNodes.push(node);
  },

  update(dt){
    this.pool.each(o => {
      o.life += dt;
      if (o.life >= o.max){ o.mesh.visible = false; return true; }
      const k = Math.exp(-o.drag * dt);
      o.vx *= k; o.vz *= k; o.vy = o.vy * k - 5.5 * dt;
      o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.y < 0.05){ o.y = 0.05; o.vy *= -0.35; }
      const t = o.life / o.max;
      o.mesh.position.set(o.x, o.y, o.z);
      o.mesh.scale.setScalar(Util.lerp(o.s0, o.s1, t));
      o.mesh.material.opacity = 1 - t * t;
      return false;
    });

    this.ringPool.each(o => {
      o.life += dt;
      if (o.life >= o.max){ o.mesh.visible = false; return true; }
      const t = o.life / o.max;
      o.mesh.scale.setScalar(Util.lerp(o.r0, o.r1, 1 - Math.pow(1 - t, 2)));
      o.mesh.material.opacity = 0.85 * (1 - t);
      return false;
    });

    for (let i = this.dmgNodes.length - 1; i >= 0; i--){
      const n = this.dmgNodes[i];
      n.t += dt;
      if (n.t > 0.72){
        n.el.style.display = 'none';
        this.dmgFree.push(n.el);
        this.dmgNodes.splice(i, 1);
        continue;
      }
      n.vy += 118 * dt;
      n.x += n.vx * dt; n.y += n.vy * dt;
      n.el.style.transform = 'translate(' + n.x.toFixed(1) + 'px,' + n.y.toFixed(1) + 'px)';
      n.el.style.opacity = String(1 - Math.pow(n.t / 0.72, 3));
    }
  },

  reset(){
    this.pool.each(o => { o.mesh.visible = false; return true; });
    this.ringPool.each(o => { o.mesh.visible = false; return true; });
    for (const n of this.dmgNodes){ n.el.style.display = 'none'; this.dmgFree.push(n.el); }
    this.dmgNodes.length = 0;
  },
};

/* ============================ Asteroids 陨石（地图障碍） ============================ */
const Asteroids = {
  pool: null, group: null, geos: null,

  init(){
    this.group = new THREE.Group();
    World.scene.add(this.group);
    this.geos = [];
    for (let k = 0; k < 3; k++){
      const g = (k === 1) ? new THREE.IcosahedronGeometry(1, 0) : new THREE.DodecahedronGeometry(1, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++){
        const f = 0.72 + Math.random() * 0.55;            // 顶点扰动，做成不规则石块
        p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
      }
      g.computeVertexNormals();
      this.geos.push(g);
    }
    // 矿物色板：灰岩 / 锈褐 / 青矿 / 紫晶（每颗陨石随机一种，增加地图层次）
    this.tints = [0x6b7280, 0x7a6b5a, 0x586b82, 0x6e5a6b];
    this.pool = Pool.create(40, () => {
      const m = new THREE.Mesh(this.geos[0], new THREE.MeshLambertMaterial({
        color: 0x6b7280, emissive: 0x10161f, emissiveIntensity: 0.5 }));
      m.visible = false; this.group.add(m);
      return { mesh: m, x:0, z:0, y:0, vx:0, vz:0, r:1.4,
               rx:0, ry:0, rz:0, rot:0, alive:false, geo:0 };
    });
  },

  spawn(x, z){
    const o = this.pool.get(); if (!o) return null;
    o.x = x; o.z = z; o.alive = true;
    const a = Math.random() * Util.TAU, sp = Util.rand(1.4, 3.6);
    o.vx = Math.cos(a) * sp; o.vz = Math.sin(a) * sp;
    o.r = Util.rand(1.2, 2.4);
    o.y = Util.rand(0.6, 1.7);
    o.rx = Math.random() * Util.TAU; o.ry = Math.random() * Util.TAU; o.rz = Math.random() * Util.TAU;
    o.rot = Util.rand(-0.6, 0.6);
    o.geo = (Math.random() * 3) | 0;
    o.mesh.geometry = this.geos[o.geo];
    // 矿物配色 + 同色发光矿脉
    const tt = Util.pick(this.tints);
    o.mesh.material.color.setHex(tt);
    o.mesh.material.emissive.setHex(tt);
    o.mesh.material.emissiveIntensity = 0.22;
    o.mesh.scale.setScalar(o.r);
    o.mesh.position.set(x, o.y, z);
    o.mesh.visible = true;
    return o;
  },

  scatter(n){
    for (let i = 0; i < n; i++){
      const a = Math.random() * Util.TAU, r = Util.rand(8, CFG.arena - 4);
      this.spawn(Math.cos(a) * r, Math.sin(a) * r);
    }
  },

  /** 按星域切换陨石矿物配色（与敌人 / 背景一同换肤） */
  retheme(tints){
    this.tints = tints.slice();
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++){
      const o = list[i]; if (!o.alive) continue;
      const tt = Util.pick(this.tints);
      o.mesh.material.color.setHex(tt);
      o.mesh.material.emissive.setHex(tt);
    }
  },

  hitTest(x, z, r){
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++){
      const o = list[i]; if (!o.alive) continue;
      const rr = r + o.r;
      if (Util.dist2(x, z, o.x, o.z) <= rr * rr) return o;
    }
    return null;
  },

  update(dt){
    const list = this.pool.active;
    for (let i = 0; i < list.length; i++){
      const o = list[i]; if (!o.alive) continue;
      o.x += o.vx * dt; o.z += o.vz * dt;
      const d = Math.hypot(o.x, o.z);
      if (d > CFG.arena - o.r){                       // 边界反弹
        const a = Math.atan2(o.z, o.x);
        o.vx = Math.cos(a) * -Math.abs(o.vx);
        o.vz = Math.sin(a) * -Math.abs(o.vz);
      }
      o.mesh.rotation.x += o.rx * dt * o.rot;
      o.mesh.rotation.y += o.ry * dt * o.rot;
      o.mesh.rotation.z += o.rz * dt * o.rot;
      o.mesh.position.set(o.x, o.y, o.z);
      // 撞玩家（双人：命中最近玩家）
      {
        const tp = Game.nearestPlayer(o.x, o.z);
        if (Game.state === 'PLAYING' && tp &&
            Util.dist2(o.x, o.z, tp.x, tp.z) < (o.r + CFG.player.radius) ** 2){
          tp.takeDamage(8);
          const a = Math.atan2(o.x - tp.x, o.z - tp.z);
          o.vx = Math.sin(a) * 8; o.vz = Math.cos(a) * 8;
          tp.vx -= Math.sin(a) * 3; tp.vz -= Math.cos(a) * 3;
        }
      }
    }
  },

  reset(){
    this.pool.each(o => { if (o.alive){ o.alive = false; o.mesh.visible = false; return true; } return false; });
  },
};

/* ============================ Minimap 小地图雷达 ============================ */
const Minimap = {
  cv: null, ctx: null, S: 150, enemyCol: null,
  init(){
    this.cv = document.getElementById('minimap');
    if (!this.cv) return;
    this.ctx = this.cv.getContext('2d');
    this.S = this.cv.width;
  },
  /** 当前星域敌人色（小地图上跟着地图风格走） */
  setAccent(hex){ this.enemyCol = hex; },
  render(){
    const c = this.ctx; if (!c) return;
    const S = this.S, A = CFG.arena, sc = (S / 2 - 4) / A;
    const X = (x) => S / 2 + x * sc, Y = (z) => S / 2 + z * sc;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(4,10,20,0.5)';
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, Util.TAU); c.fill();
    c.strokeStyle = 'rgba(56,240,255,0.5)'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = '#6b7280';
    for (const o of Asteroids.pool.active){ if (!o.alive) continue;
      c.beginPath(); c.arc(X(o.x), Y(o.z), Math.max(1.5, o.r * sc), 0, Util.TAU); c.fill(); }
    c.fillStyle = this.enemyCol || '#ff5c7a';
    for (const e of Enemies.pool.active){ if (!e.alive) continue;
      c.beginPath(); c.arc(X(e.x), Y(e.z), 2, 0, Util.TAU); c.fill(); }
    c.fillStyle = '#5dff9b';
    for (const w of Wingmen.list){
      c.beginPath(); c.arc(X(w.x), Y(w.z), 2, 0, Util.TAU); c.fill(); }
    if (Boss.active){ c.fillStyle = '#ff3d7f';
      c.beginPath(); c.arc(X(Boss.x), Y(Boss.z), 5, 0, Util.TAU); c.fill(); }
    for (const p of Game.players){
      if (p._dead) continue;
      c.fillStyle = p.id === 2 ? '#4dd2ff' : '#38f0ff';
      c.beginPath(); c.arc(X(p.x), Y(p.z), 3, 0, Util.TAU); c.fill();
    }
  },
};
