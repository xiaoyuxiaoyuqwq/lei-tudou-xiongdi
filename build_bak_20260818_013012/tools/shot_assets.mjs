/**
 * 网络素材接入后：截一张真实战斗画面（无弹窗干扰），校验飞船朝向与素材渲染。
 * 用法：node tools/shot_assets.mjs
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

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

await page.evaluate(() => {
  Enemies.spawnTimer = 9999;
  Player.maxHp = 9999; Player.hp = 9999;
  Player.x = 0; Player.z = 0;

  Progress.weapons = { cannon: 4, missile: 3, laser: 2, aura: 2 };
  Progress.passives = { speed: 2, rate: 3, crit: 3, pick: 4 };
  Progress.applyCard({ type: 'wing', key: 'striker' });
  Progress.applyCard({ type: 'wing', key: 'warden' });
  Progress.applyCard({ type: 'wing', key: 'howitzer' });
  Game.wave = 10;
  Game.time = 60 * 9.5;

  const layouts = [
    { kind: 'charger',  n: 6, r: 9 },
    { kind: 'orbiter',  n: 5, r: 12 },
    { kind: 'sniper',   n: 4, r: 16 },
    { kind: 'splitter', n: 3, r: 21 },
    { kind: 'mini',     n: 8, r: 6 },
    { kind: 'elite',    n: 2, r: 26 }
  ];
  for (const L of layouts){
    for (let i = 0; i < L.n; i++){
      const th = (i / L.n) * 6.283 + 0.15;
      Enemies.spawn(L.kind, Math.cos(th) * L.r, Math.sin(th) * L.r, 4, 1.5, 1, L.kind === 'elite');
    }
  }
  // 冻结敌机：原地不动但保持朝向玩家（检验 SHIP_ROT）
  Enemies.pool.active.forEach(e => { e.spd = 0; });

  // 掉落图标 + 经验星标
  Loot.dropItem(13, 0, 'repair');
  Loot.dropItem(-13, 4, 'magnet');
  Loot.dropItem(0, -14, 'nuke');
  for (let i = 0; i < 36; i++){
    const th = Math.random() * 6.283, r = 5 + Math.random() * 22;
    Loot.dropGem(Math.cos(th) * r, Math.sin(th) * r, [1, 5, 20][i % 3]);
  }

  // BOSS
  Boss.spawn();

  // 压制升级弹窗
  Progress.pending = 0;
  if (Game.state === 'LEVELUP') Game.state = 'PLAYING';
  for (const id of ['levelup', 'gameover', 'start']){
    const el = document.getElementById(id); if (el) el.classList.add('hide');
  }
  window.__guard = setInterval(() => {
    if (Game.state === 'LEVELUP'){ Progress.pending = 0; Game.state = 'PLAYING'; }
    const lv = document.getElementById('levelup'); if (lv) lv.classList.add('hide');
    const go = document.getElementById('gameover'); if (go) go.classList.add('hide');
  }, 40);
});

// 等待 BOSS 进场就位（2.8s 演出）+ 朝向稳定
await new Promise(r => setTimeout(r, 3600));
await page.screenshot({ path: path.join(__dirname, 'shot_assets.png') });
await page.evaluate(() => { clearInterval(window.__guard); });
console.log('saved shot_assets.png');
await browser.close();
