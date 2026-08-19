import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CHROME = execSync('where chrome 2>nul || dir /b /s "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" 2>nul || dir /b /s "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" 2>nul || echo C:\\Users\\72763\\.cache\\puppeteer\\chrome\\*\\chrome-win64\\chrome.exe').toString().trim().split('\n').pop().trim();

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1280,800','--ignore-gpu-blocklist']
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto('file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/'), { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 1200));
await page.click('#btnStart');
await new Promise(r => setTimeout(r, 600));

// 摆拍：玩家 + 三类僚机 + 各系敌机 + BOSS，全程压制升级弹窗 + 关闭自动拾取
await page.evaluate(() => {
  Enemies.spawnTimer = 99999;
  Player.maxHp = 99999; Player.hp = 99999;
  Player.x = 0; Player.z = 0; Player.yaw = 0; Player.facing = 0;
  Progress.pending = 0;
  Game.enterLevelUp = () => {};                 // 屏蔽选卡弹窗
  Loot.pool.releaseAll();                        // 清掉会触发拾取的晶体

  Progress.applyCard({ type: 'wing', key: 'striker' });
  Progress.applyCard({ type: 'wing', key: 'warden' });
  Progress.applyCard({ type: 'wing', key: 'howitzer' });
  Game.wave = 10;

  const layouts = [
    { kind: 'charger',  n: 5, r: 11 },
    { kind: 'orbiter',  n: 4, r: 15 },
    { kind: 'sniper',   n: 3, r: 19 },
    { kind: 'splitter', n: 3, r: 24 },
    { kind: 'mini',     n: 6, r: 7 },
    { kind: 'elite',    n: 1, r: 29 }
  ];
  for (const L of layouts)
    for (let i = 0; i < L.n; i++){
      const th = (i / L.n) * 6.283 + Math.random() * 0.3;
      Enemies.spawn(L.kind, Math.cos(th)*L.r, Math.sin(th)*L.r, 4, 1.5, 0, L.kind === 'elite');
    }

  Boss.spawn();
  // 强制 BOSS 退出进场演出，展示完整旗舰建模
  Boss.entering = false; Boss.entranceT = Boss.entranceDur;

  for (const id of ['levelup','gameover','start','wavetip','bossbar'])
    { const el = document.getElementById(id); if (el) el.classList.add('hide'); }
});
await new Promise(r => setTimeout(r, 1500));
await page.evaluate(() => {
  Progress.pending = 0;
  if (Game.state === 'LEVELUP') Game.state = 'PLAYING';
  for (const id of ['levelup','gameover','start','wavetip','bossbar'])
    { const el = document.getElementById(id); if (el) el.classList.add('hide'); }
});
await page.screenshot({ path: path.join(__dirname, 'shot_fleet_shadow.png') });

// 单独拉近 BOSS 旗舰：把玩家放 BOSS 正下方，并把 BOSS 放大 1.7 倍突出旗舰建模
await page.evaluate(() => {
  Player.x = Boss.x; Player.z = Boss.z;
  if (Boss.obj) Boss.obj.group.scale.setScalar(1.7);
});
await new Promise(r => setTimeout(r, 900));
await page.evaluate(() => {
  Progress.pending = 0;
  if (Game.state === 'LEVELUP') Game.state = 'PLAYING';
  for (const id of ['levelup','gameover','start','wavetip','bossbar'])
    { const el = document.getElementById(id); if (el) el.classList.add('hide'); }
});
await page.screenshot({ path: path.join(__dirname, 'shot_boss_shadow.png') });

console.log('errors:', errs.length, errs.slice(0,3).join(' | '));
await browser.close();
