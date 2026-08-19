// 合并后单文件语法校验：捕获跨分片的重复 const/let / 语法错误
// 这些错误 node --check（逐文件）捕不到，但会让整段脚本解析失败 → #boot 永远 LOADING
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('index.html', 'utf8');
// 抽取所有内联 <script>（无 src）的内容
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, idx = 0, found = false;
while ((m = re.exec(html))) {
  const code = m[1];
  if (code.trim().length < 50) continue; // 跳过空/极短
  found = true; idx++;
  try {
    new vm.Script(code, { filename: `inline-script-${idx}.js` });
    console.log(`✓ 内联脚本 #${idx} 语法 OK (${code.length} 字符)`);
  } catch (e) {
    console.log(`✗ 内联脚本 #${idx} 语法错误: ${e.message}`);
    if (e.stack) {
      const line = (e.stack.split('\n')[0].match(/evalmachine.*?:(\d+)/) || [,'?'])[1];
      console.log(`  行号≈${line}`);
    }
  }
}
if (!found) console.log('未找到内联脚本');
