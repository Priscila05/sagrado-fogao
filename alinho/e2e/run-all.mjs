/**
 * Roda todas as baterias de teste de navegador, na ordem (elas compartilham o
 * mesmo perfil do Chromium de propósito, para testar persistência real).
 *
 * Pré-requisitos: `npm run build` e, em outro terminal, `npm run preview`.
 *
 * As baterias dividem o mesmo perfil do Chromium, então precisam rodar em
 * sequência: duas execuções ao mesmo tempo disputam o perfil e falham sozinhas.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = fs
  .readdirSync(here)
  .filter((file) => /^\d\d-.*\.mjs$/.test(file))
  .sort();

let failed = 0;
for (const script of scripts) {
  console.log(`\n##### ${script} #####`);
  const result = spawnSync(process.execPath, [path.join(here, script)], { stdio: 'inherit' });
  if (result.status !== 0) failed += 1;
}

console.log(`\n${scripts.length - failed}/${scripts.length} baterias concluídas sem falhas.`);
process.exit(failed === 0 ? 0 : 1);
