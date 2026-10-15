/**
 * Infraestrutura dos testes de navegador.
 *
 * Os roteiros rodam contra o build de produção servido localmente
 * (`npm run build && npm run preview`) e usam um perfil persistente do Chromium,
 * para que o IndexedDB sobreviva entre as baterias — é assim que a persistência
 * "fechar e reabrir o aplicativo" é testada de verdade.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const BASE = process.env.ALINHO_E2E_BASE || 'http://localhost:4280';
export const PROFILE = path.join(here, '.artifacts', 'profile');
export const OUT = path.join(here, '.artifacts', 'out');

fs.mkdirSync(OUT, { recursive: true });

const results = [];
export function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ` :: ${detail}` : ''}`);
}

export function summary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passaram ====`);
  if (failed.length) {
    console.log('FALHAS:');
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

export async function openApp({ fresh = false, viewport = { width: 1440, height: 900 } } = {}) {
  if (fresh) fs.rmSync(PROFILE, { recursive: true, force: true });
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: true,
    viewport,
    acceptDownloads: true,
    downloadsPath: OUT,
    args: ['--no-sandbox'],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  return { context, page, errors };
}

export async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
