/** 生成多张"机型图鉴"风格截图（顶视 + 红箭头机头 + 蓝点机尾 + 底座光晕 + 阵营配色）。
 *  复用 tools/catalog.html（参数化渲染器），分别产出：
 *    shot_catalog_all.png      全部 11 架（原始配色）
 *    shot_catalog_players.png  4 架玩家战机（阵营配色）
 *    shot_catalog_wingmen.png  3 架僚机（阵营配色）
 *    shot_catalog_enemies.png  5 种敌人（阵营配色）
 *    shot_catalog_boss.png     BOSS 3 部件（阵营配色）
 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, 'catalog.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = 1500, H = 1000;

const jobs = [
  { out: 'shot_catalog_all.png', title: '机型总览', sub: 'ALL UNITS · 11 架', cols: 4,
    items: ['fighter','wing_a','wing_b','enemy_charger','enemy_orbiter','enemy_sniper','enemy_splitter','enemy_brute','boss_spine','boss_core','boss_arm']
      .map(k => ({ key:k, label:k })) },

  { out: 'shot_catalog_players.png', title: '玩家战机', sub: 'PLAYER SHIPS · 4 架', cols: 4,
    items: [
      { key:'fighter',       label:'游隼',   tint:0x38f0ff },
      { key:'wing_a',        label:'游骑兵', tint:0x6dff8b },
      { key:'enemy_charger', label:'先锋',   tint:0xffd24a },
      { key:'enemy_brute',   label:'泰坦',   tint:0xff6b95 },
    ]},

  { out: 'shot_catalog_wingmen.png', title: '僚机编队', sub: 'WINGMEN · 3 架', cols: 3,
    items: [
      { key:'wing_a',        label:'突击僚机', tint:0xffcc33 },
      { key:'wing_b',        label:'守护僚机', tint:0x5dff9b },
      { key:'enemy_charger', label:'榴弹僚机', tint:0xff8a3d },
    ]},

  { out: 'shot_catalog_enemies.png', title: '敌方单位', sub: 'ENEMIES · 5 种', cols: 5,
    items: [
      { key:'enemy_charger', label:'冲锋兵', tint:0xff4d6d },
      { key:'enemy_orbiter', label:'环绕者', tint:0xb980ff },
      { key:'enemy_sniper',  label:'狙击手', tint:0x4dd2ff },
      { key:'enemy_splitter',label:'分裂体', tint:0x8fff5d },
      { key:'enemy_brute',   label:'重甲',   tint:0xff7a2f },
    ]},

  { out: 'shot_catalog_boss.png', title: 'BOSS 要塞', sub: 'BOSS PARTS · 3 件', cols: 3,
    items: [
      { key:'boss_spine', label:'主脊', tint:0xff3d7f },
      { key:'boss_core',  label:'核心', tint:0xff3d7f },
      { key:'boss_arm',   label:'机械臂', tint:0xff3d7f },
    ]},
];

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', `--window-size=${W},${H}`]
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[err]', e.message));
await page.setViewport({ width: W, height: H });

for (const job of jobs){
  await page.evaluateOnNewDocument((j) => {
    window.CAT_TITLE = j.title;
    window.CAT_SUB   = j.sub;
    window.CAT_COLS  = j.cols;
    window.CAT_ITEMS = j.items;
  }, job);
  await page.goto(PAGE, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));
  const ready = await page.evaluate(() => !!window.__ready && !!window.MESHES);
  await page.screenshot({ path: path.join(__dirname, job.out) });
  console.log('→', job.out, ready ? 'OK' : 'WARN(未就绪)');
}
await browser.close();
console.log('done.');
