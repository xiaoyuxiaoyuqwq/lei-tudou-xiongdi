import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(PAGE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 1200));
const fs = await import('fs');
try {
  await page.evaluate(() => { Game.start(); });
  await page.evaluate(() => { for (let i=0;i<3;i++) Wingmen.add(['striker','warden','howitzer'][i]); });
  await new Promise(r => setTimeout(r, 3500));   // 让波次刷敌 + 陨石在场
  await page.screenshot({ path: path.join(__dirname, 'shot_fix.png') });
  console.log('shot_fix.png 已生成; 报错数=' + errs.length);
} catch (e) { console.log('SCRIPT ERROR: ' + e.message); }
await browser.close();
