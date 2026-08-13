/**
 * 新敌人专项验证：掠袭蜂(wasp) / 治愈者(mender) / 折跃者(phaser)
 *   1) 三个新模型已烘焙进 meshes.js（Mesh.parts 顶点 > 0）
 *   2) SPEC / ai 正确，waveSpec 在 w3/w5/w6 起登场
 *   3) mender 周期治疗附近受伤友军（hp 回升）
 *   4) phaser 冷却一到朝玩家瞬移（距离明显缩短）
 *   5) wasp 可成簇刷出且模型正常
 *   6) 全程零控制台报错
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE  = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c){ pass++; console.log('  ✔ ' + m); } else { fail++; console.log('  �’✗ ' + m); } };

const browser = await puppeteer.launch({
  executablePath: EXE, headless: 'new',
  args: ['--no-sandbox','--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto('file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/'), { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(2500);

const r = await page.evaluate(() => {
  Game.start(false);
  Game.state = 'PLAYING';
  Enemies.clear();

  // —— mender 治疗友军 ——
  const ally = Enemies.spawn('brute', 20, 0, 1, 1, 1, false);
  Enemies.damage(ally, 60, false, ally.x, ally.z);
  const allyHpBefore = ally.hp;
  const mend = Enemies.spawn('mender', 20.6, 0, 1, 1, 1, false);
  mend.healCd = 0;
  Enemies.update(0.05);
  const allyHpAfter = ally.hp;

  // —— phaser 折跃 ——
  Enemies.clear();
  const ph = Enemies.spawn('phaser', 22, 0, 1, 1, 1, false);
  ph.blinkCd = 0;
  const dBefore = Math.hypot(ph.x - Player.x, ph.z - Player.z);
  Enemies.update(0.05);
  const dAfter = Math.hypot(ph.x - Player.x, ph.z - Player.z);

  // —— 模型存在 ——
  const cnt = k => { const p = MESHES[k]; return p && p.parts ? p.parts.reduce((a, x) => a + x.p.length / 3, 0) : 0; };
  const hasWasp = cnt('wasp') > 0, hasMender = cnt('mender') > 0, hasPhaser = cnt('phaser') > 0;

  // —— SPEC / ai / 波次 ——
  const specOk = !!(Enemies.SPEC.wasp && Enemies.SPEC.mender && Enemies.SPEC.phaser);
  const aiOk = Enemies.SPEC.wasp.ai === 'chase' && Enemies.SPEC.mender.ai === 'support' && Enemies.SPEC.phaser.ai === 'blink';
  const ws3 = Game.waveSpec(3).kinds.includes('wasp');
  const ws5 = Game.waveSpec(5).kinds.includes('mender');
  const ws6 = Game.waveSpec(6).kinds.includes('phaser');

  // —— wasp 成簇刷 + 模型正常 ——
  Enemies.clear();
  for (let i = 0; i < 4; i++) Enemies.spawn('wasp', 10 + i, 5, 1, 1, 1, false);
  const waspCount = Enemies.pool.count;
  const waspMeshOk = Enemies.pool.active.filter(e => e.kind === 'wasp').every(e => e.mesh && e.mesh.children.length > 0);

  return { allyHpBefore, allyHpAfter, dBefore, dAfter, hasWasp, hasMender, hasPhaser,
           specOk, aiOk, ws3, ws5, ws6, waspCount, waspMeshOk };
});

console.log('— 模型 —');
ok(r.hasWasp,    'wasp 模型已烘焙 (verts>0)');
ok(r.hasMender,  'mender 模型已烘焙 (verts>0)');
ok(r.hasPhaser,  'phaser 模型已烘焙 (verts>0)');
console.log('— 配置 —');
ok(r.specOk, 'SPEC 含 wasp/mender/phaser');
ok(r.aiOk,   'ai 分别为 chase/support/blink');
ok(r.ws3, 'waveSpec(3) 起出现 wasp');
ok(r.ws5, 'waveSpec(5) 起出现 mender');
ok(r.ws6, 'waveSpec(6) 起出现 phaser');
console.log('— 行为 —');
ok(r.allyHpAfter > r.allyHpBefore, `mender 治疗友军 (${r.allyHpBefore.toFixed(0)} → ${r.allyHpAfter.toFixed(0)} hp)`);
ok(r.dAfter < r.dBefore - 3, `phaser 折跃逼近 (dist ${r.dBefore.toFixed(1)} → ${r.dAfter.toFixed(1)})`);
ok(r.waspCount >= 4 && r.waspMeshOk, `wasp 成簇刷出 (${r.waspCount} 只，模型正常)`);
console.log('— 稳定性 —');
ok(errors.length === 0, '零控制台报错' + (errors.length ? ' → ' + errors.slice(0,3).join(' | ') : ''));

await browser.close();
console.log(`\n结果：通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
