/* 把 build/ 下的分片拼成单文件 index.html
 * 同时将 three.min.js 与 assets/meshes.js 内联，使产物完全自包含
 * （离线 / 预览环境均可运行，不再依赖 CDN —— 避免无网络时 three 加载失败导致一直 LOADING）。
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

// 内联外部依赖并去除 CDN 依赖。
// 任何一步失败都直接退出，绝不产出「残留 CDN 标签」的坏文件（那会让整段脚本解析失败 → 一直 LOADING）。
const inlineFile = (rel, label) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    console.error(`!! 缺失 ${rel}，无法内联（${label}）`);
    process.exit(1);
  }
  let src = fs.readFileSync(p, 'utf8');
  // 防呆：若依赖文件自身被污染（含 CDN 引用 / 裸 </script），拒绝内联
  if (/cdn\.jsdelivr|<\/script/i.test(src)) {
    console.error(`!! ${rel} 内容异常（含 CDN 引用或裸 </script>），拒绝内联以防破坏脚本`);
    process.exit(1);
  }
  // 转义内部可能的 </script>，避免提前闭合外层 <script> 块
  src = src.replace(/<\/script/gi, '<\\/script');
  return '<script>\n' + src + '\n</script>';
};

let out = fs.readFileSync(B('p1_shell.html'), 'utf8');
if (!out.endsWith('\n')) out += '\n';

// 用正则匹配原始外部标签（容错引号/空白差异），整体替换为内联块
const threeTag = /<script\s+src=["'][^"']*three\.min\.js[^"']*["']\s*>\s*<\/script>/i;
const meshesTag = /<script\s+src=["']assets\/meshes\.js["']\s*>\s*<\/script>/i;

if (!threeTag.test(out)) {
  console.error('!! 未在 p1_shell.html 中找到 three CDN 标签');
  process.exit(1);
}
if (!meshesTag.test(out)) {
  console.error('!! 未在 p1_shell.html 中找到 meshes 标签');
  process.exit(1);
}

// ⚠️ 必须用「函数」作为替换值！
// three.min.js 源码里含 $& / $` 等正则替换惯用法；若直接传字符串给 replace，
// 这些会被当成「反向引用」把刚被删掉的 CDN 标签整段又塞回产物（导致一直 LOADING）。
// 用函数返回则按字面量插入，不做 $ 解释。
out = out.replace(threeTag, () => inlineFile('three.min.js', 'three'));
out = out.replace(meshesTag, () => inlineFile(path.join('assets', 'meshes.js'), 'meshes'));

// 兜底断言：构建后绝不允许残留任何外部依赖
if (/cdn\.jsdelivr|src=["']assets\/meshes\.js/i.test(out)) {
  console.error('!! 构建后仍存在外部依赖引用，中止（产物会一直 LOADING）');
  process.exit(1);
}

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
console.log(`✔ index.html 生成完毕  ${kb} KB  (${PARTS.length + 1} 个分片，three+meshes 已内联，无外部依赖)`);
