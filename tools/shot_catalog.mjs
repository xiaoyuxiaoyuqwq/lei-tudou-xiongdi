/** 渲染 assets/meshes.js 里全部模型的顶视总览图，用于目视挑选与朝向校准。
 *  红色箭头 = 模型本地 +Z；蓝色小球 = -Z（游戏中玩家前进方向）。 */
import puppeteer from 'file:///C:/Users/72763/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file:///' + path.join(__dirname, 'catalog.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader',
         '--enable-unsafe-swiftshader', '--window-size=1500,1000']
});
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.text()));
page.on('pageerror', e => console.log('[err]', e.message));
await page.setViewport({ width: 1500, height: 1000 });
await page.goto(PAGE, { waitUntil: 'networkidle2' });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: path.join(__dirname, 'shot_catalog.png') });
console.log('→ tools/shot_catalog.png');
await browser.close();
