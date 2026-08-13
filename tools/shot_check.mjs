// 程序化验证 VFX 打磨：无人机旋翼是否在转 + FX 活跃粒子是否 >0（命中/拖尾/受击）
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1440,900'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await page.waitForSelector('#btnStart', { timeout: 10000 });
await new Promise(r => setTimeout(r, 400));

// 蜂巢战机（自带无人僚机）+ 强制 4 架，方便观察旋翼
await page.evaluate(() => { Game.shipIdx = 8; Audio2.init(); Audio2.resume(); Game.start(false); Progress.weapons.drone = 4; });
await new Promise(r => setTimeout(r, 2600));

const before = await page.evaluate(() => {
  const r = Weapons.drones[0] && Weapons.drones[0].mesh.userData.rotors;
  return r ? r.rotation.y : null;
});
await new Promise(r => setTimeout(r, 350));
const after = await page.evaluate(() => {
  const r = Weapons.drones[0] && Weapons.drones[0].mesh.userData.rotors;
  return r ? r.rotation.y : null;
});
const fxActive = await page.evaluate(() => {
  let n = 0; for (const o of FX.pool.active) if (o.mesh.visible) n++; return n;
});
const droneVis = await page.evaluate(() => Weapons.drones.filter(d => d.mesh.visible).length);
const ringVis = await page.evaluate(() => { let n = 0; for (const o of FX.ringPool.active) if (o.mesh.visible) n++; return n; });

console.log(JSON.stringify({
  rotorBefore: before, rotorAfter: after,
  rotorSpins: (before !== null && after !== null && before !== after),
  fxParticlesActive: fxActive, shockRingsActive: ringVis, droneVisible: droneVis,
  errors: errors.length ? errors : 'none',
}, null, 2));
await browser.close();
