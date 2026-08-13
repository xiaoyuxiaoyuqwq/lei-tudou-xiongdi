/* 把 build/ 下的分片拼成单文件 index.html
 * 用法：node tools/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = (f) => path.join(ROOT, 'build', f);

const PARTS = [
  'p2_core.js',
  'p3_world.js',
  'p4_player.js',
  'p5_weapons.js',
  'p6_enemies.js',
  'p7_boss.js',
  'p8_game.js',
];

let out = fs.readFileSync(B('p1_shell.html'), 'utf8');
if (!out.endsWith('\n')) out += '\n';

for (const p of PARTS) {
  const src = fs.readFileSync(B(p), 'utf8');
  if (/<\/script>/i.test(src)) {
    console.error(`!! ${p} 内含 </script>，会提前闭合脚本块`);
    process.exit(1);
  }
  out += `\n/* ==================== ${p} ==================== */\n`;
  out += src.endsWith('\n') ? src : src + '\n';
}

out += '\n</script>\n</body>\n</html>\n';

const dst = path.join(ROOT, 'index.html');
fs.writeFileSync(dst, out, 'utf8');

const kb = (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1);
console.log(`✔ index.html 生成完毕  ${kb} KB  (${PARTS.length + 1} 个分片)`);
