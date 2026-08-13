// 生成 assets/models.js：把免费低多边形飞船 GLB 以 base64 内嵌。
// 运行：node tools/gen_models.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'models_tmp');

// 模型清单（全部来自 Poly Pizza，CC0 / CC-BY，授权干净）
const MAP = [
  { key: 'kenney',    file: 'pp_kenney.glb',     note: 'Poly Pizza "Mining Spacecraft" by Kenney (CC0)' },
  { key: 'spaceship', file: 'pp_spaceship.glb',  note: 'Poly Pizza "SpaceShip" by akushal_hin (CC-BY)' },
  { key: 'rocket',    file: 'pp_rocket.glb',     note: 'Poly Pizza "Rocketship" by Gabriel Valdivia (CC-BY)' },
];

const lines = [];
lines.push('// 自动生成：免费 CC0/CC-BY 低多边形飞船 GLB，base64 内嵌，WebGL 安全（file:// 双击可运行）');
lines.push('// 来源（均在 Poly Pizza，CC0 / CC-BY）：');
for (const m of MAP) lines.push(`//   ${m.key.padEnd(10)} = ${m.note}`);
lines.push('// 朝向微调：若某船机头朝后，把对应 spinY 改为 Math.PI 即可。');
lines.push('window.MODELS = {');
for (const m of MAP) {
  const buf = fs.readFileSync(path.join(SRC, m.file));
  const b64 = buf.toString('base64');
  lines.push(`  "${m.key}": "data:model/gltf-binary;base64,${b64}",`);
}
lines.push('};');
lines.push('window.MODEL_CFG = {');
for (const m of MAP) lines.push(`  ${m.key}: { spinY: 0 },`);
lines.push('};');

const out = path.join(ROOT, 'assets', 'models.js');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log('wrote', out, fs.statSync(out).size, 'bytes');
for (const m of MAP) {
  const buf = fs.readFileSync(path.join(SRC, m.file));
  console.log(`  ${m.key}: ${buf.length} bytes -> base64 ok`);
}
