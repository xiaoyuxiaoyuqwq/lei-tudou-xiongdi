/**
 * 截三张图分别验证三个新特效：
 *   shot_boss_enter.png — BOSS 进场演出（滑入 + 预警环 + 光晕）
 *   shot_models.png     — 稳定战斗（僚机引擎尾焰 + 击杀碎片）
 *   shot_kill.png       — 击杀粒子迸射特写
 *
 * 注意：Player.pickR 是 getter，赋值无效。截图前用以下手段屏蔽弹窗：
 *   1) 覆写 Game.enterLevelUp 为 no-op（防止选卡弹窗再现）
 *   2) 清空 Loot 池与 Progress 经验/队列
 *   3) 强制 Game.state = PLAYING + 内联 display:none
 * 用法：node tools/shot_fx.mjs
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const SUITE_HIDE_POPUP = `
  Game.enterLevelUp = function(){ this.state = 'PLAYING'; this.cards = null; };
  Loot.pool.releaseAll();
  Progress.exp = 0; Progress.pending = 0;
  Game.state = 'PLAYING';
  for (const id of ['levelup', 'gameover', 'start']){
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
`;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle',
         '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--window-size=1440,900']
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));

await page.click('#btnStart');
await new Promise(r => setTimeout(r, 800));

await page.evaluate(`
  Enemies.spawnTimer = 9999;
  Player.maxHp = 9999; Player.hp = 9999;
  Player.x = 0; Player.z = 0;
  Progress.weapons = { cannon:4, missile:3, laser:2, aura:2 };
  Progress.passives = { speed:2, rate:3, crit:3, pick:4 };
  Progress.applyCard({ type:'wing', key:'striker' });
  Progress.applyCard({ type:'wing', key:'warden' });
  Progress.applyCard({ type:'wing', key:'howitzer' });

  const layouts = [
    { kind:'charger', n:6, r:9 }, { kind:'orbiter', n:5, r:12 },
    { kind:'sniper', n:4, r:16 }, { kind:'splitter', n:3, r:21 },
    { kind:'mini', n:8, r:6 }, { kind:'elite', n:2, r:26 }
  ];
  for (const L of layouts)
    for (let i = 0; i < L.n; i++){
      const th = (i / L.n) * 6.283 + Math.random() * 0.3;
      Enemies.spawn(L.kind, Math.cos(th)*L.r, Math.sin(th)*L.r, 4, 1.5, 1, L.kind === 'elite');
    }

  Boss.spawn();
  Boss.tx = 14; Boss.tz = 0; Boss.sx = 30; Boss.sz = 0;
  if (Boss.glow) Boss.glow.position.set(14, 0.2, 0);
  if (Boss.warn) Boss.warn.position.set(14, 0.15, 0);

  ${SUITE_HIDE_POPUP}
`);

// ① 进场演出中途
await new Promise(r => setTimeout(r, 1300));
await page.evaluate(SUITE_HIDE_POPUP);
await page.screenshot({ path: path.join(__dirname, 'shot_boss_enter.png') });
console.log('saved shot_boss_enter.png');

// ② 稳定战斗
await new Promise(r => setTimeout(r, 1900));
await page.evaluate(SUITE_HIDE_POPUP);
await page.screenshot({ path: path.join(__dirname, 'shot_models.png') });
console.log('saved shot_models.png');

// ③ 击杀粒子特写
await page.evaluate(`
  const es = [];
  for (let i = 0; i < 18; i++){
    const th = Math.random() * 6.283, r = 3 + Math.random() * 4;
    es.push(Enemies.spawn('charger', Math.cos(th)*r, Math.sin(th)*r + 5, 4, 1.5, 1, false));
  }
  for (const e of es) if (e && e.alive) Enemies.kill(e);
  ${SUITE_HIDE_POPUP}
`);
await new Promise(r => setTimeout(r, 110));
await page.screenshot({ path: path.join(__dirname, 'shot_kill.png') });
console.log('saved shot_kill.png');

await browser.close();