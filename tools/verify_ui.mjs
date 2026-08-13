/** 断言 UI 改造真实生效（不依赖肉眼看图） */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1000));

let pass = 0, fail = 0;
const ok = (n, c, extra) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + n + (extra ? ' — ' + extra : '')); };

// 1. 战机卡片动态生成 + 属性条
const cards = await page.evaluate(() => {
  const cs = document.querySelectorAll('#shipCards .ship-card');
  return Array.from(cs).map(c => ({
    name: c.querySelector('b')?.textContent,
    bars: c.querySelectorAll('.bar i').length,
    firstW: c.querySelector('.bar i')?.style.width,
    sw: c.querySelector('.sw')?.style.background,
  }));
});
ok('战机卡片数 = 4', cards.length === 4, 'got ' + cards.length);
ok('每张卡片含 3 条属性(装甲/速度/射速)', cards.every(c => c.bars === 3));
ok('属性条宽度已填充', cards.every(c => c.firstW && c.firstW.endsWith('%')));
ok('战机色块已上色', cards.every(c => c.sw && c.sw.startsWith('rgb')));

// 2. 暂停面板
await page.evaluate(() => { Audio2.init(); Game.start(false); });
await new Promise(r => setTimeout(r, 600));
await page.evaluate(() => Game.togglePause());
await new Promise(r => setTimeout(r, 300));
const pause = await page.evaluate(() => {
  const p = document.getElementById('pause');
  return {
    shown: !p.classList.contains('hide'),
    btns: ['btnResume','btnRestart','btnMenu'].map(id => !!document.getElementById(id)),
  };
});
ok('暂停面板可见', pause.shown);
ok('暂停含 继续/重新开始/返回菜单 三按钮', pause.btns.every(Boolean), JSON.stringify(pause.btns));

// 3. 结算面板：DPS + 返回菜单
await page.evaluate(() => Game.togglePause());
await new Promise(r => setTimeout(r, 200));
await page.evaluate(() => { Game.dmgDealt = 1234; Game.time = 30; Game.over(true); });
await new Promise(r => setTimeout(r, 700));
const res = await page.evaluate(() => ({
  shown: !document.getElementById('overlay').classList.contains('hide'),
  dps: document.getElementById('rDps').textContent,
  menuBtn: !document.getElementById('btnMenuR').classList.contains('hide'),
  shipRowHidden: document.getElementById('shipRow').classList.contains('hide'),
}));
ok('结算面板可见', res.shown);
ok('结算 DPS 已计算', parseInt(res.dps, 10) > 0, 'dps=' + res.dps);
ok('结算显示「返回菜单」按钮', res.menuBtn);
ok('结算时隐藏战机选择行', res.shipRowHidden);

await browser.close();
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
