import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
console.log('ROOT=', ROOT);
console.log('three.min.js exists=', fs.existsSync(path.join(ROOT, 'three.min.js')));
console.log('assets/meshes.js exists=', fs.existsSync(path.join(ROOT, 'assets', 'meshes.js')));
const out = fs.readFileSync(path.join(ROOT, 'build', 'p1_shell.html'), 'utf8');
const t = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>';
console.log('threeTag present in p1_shell.html=', out.includes(t));
out.split('\n').forEach((l, i) => { if (/script|src=/.test(l)) console.log((i + 1) + ': ' + l.slice(0, 95)); });
