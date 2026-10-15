/**
 * Packages the production build for manual upload to Netlify.
 *
 * Produces `dist-zip/alinho-netlify.zip` with `index.html` at the ROOT of the
 * archive (Netlify refuses a zip that only contains a folder), then verifies
 * the result by listing the archive's entries.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const outDir = path.join(root, 'dist-zip');
const zipPath = path.join(outDir, 'alinho-netlify.zip');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html não encontrado. Rode "npm run build" antes de empacotar.');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(zipPath, { force: true });

// `-r .` from inside dist keeps the paths relative to the build root.
execFileSync('zip', ['-r', '-q', '-X', zipPath, '.'], { cwd: dist });

const listing = execFileSync('zip', ['-sf', zipPath], { encoding: 'utf8' });
const entries = listing
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('Archive contains') && !line.startsWith('Total'));

const required = ['index.html', '_redirects'];
const missing = required.filter((file) => !entries.includes(file));
if (missing.length > 0) {
  console.error(`O pacote está incompleto. Faltando na raiz: ${missing.join(', ')}`);
  process.exit(1);
}
if (!entries.some((entry) => entry.startsWith('assets/'))) {
  console.error('O pacote não contém a pasta assets/.');
  process.exit(1);
}

const size = (fs.statSync(zipPath).size / 1024).toFixed(0);
console.log(`Pacote gerado: ${path.relative(root, zipPath)} (${size} kB)`);
console.log(`Conteúdo da raiz: ${entries.filter((e) => !e.includes('/')).join(', ')}`);
console.log(`Arquivos em assets/: ${entries.filter((e) => e.startsWith('assets/')).length}`);
