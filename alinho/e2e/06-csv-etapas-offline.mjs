import { openApp, record, summary, shot, OUT, BASE } from './helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Perfil limpo: esta bateria cria todo o seu próprio estado.
const { context, page, errors } = await openApp({ fresh: true });

// --- importação CSV com prévia e mapeamento de colunas
const csvPath = path.join(OUT, 'importar.csv');
fs.writeFileSync(
  csvPath,
  'Estabelecimento;Contato;Telefone;E-mail;Cidade;Valor;Etapa;Prioridade\n' +
    'Floricultura Jardim Novo;Helena Prado;4132224444;helena@jardimnovo.com.br;Curitiba;2.600,00;Interessado;Alta\n' +
    'Mecânica Dois Irmãos;Jorge Mendes;4133335555;;Colombo;5200;Negociação;Média\n' +
    ';;;;;;;\n',
  'utf8',
);

await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const before = await page.locator('tbody tr').count();
await page.getByRole('button', { name: 'Importar CSV' }).click();
await page.setInputFiles('input[type="file"][accept*="csv"]', csvPath);
await page.waitForTimeout(600);
const previewText = await page.getByRole('dialog').innerText();
record(
  'CSV: prévia mostra colunas, exemplo e total de linhas',
  /associação de colunas/i.test(previewText) && previewText.includes('Importar 2 linha(s)'),
  // a linha totalmente vazia já é descartada na leitura: 3 linhas no arquivo, 2 válidas
  previewText.includes('Importar 2 linha(s)') ? '2 linhas válidas de 3' : previewText.slice(0, 120),
);
await shot(page, '20-csv-mapeamento');

const mappedValue = await page
  .getByRole('combobox', { name: /Campo para a coluna Valor/ })
  .inputValue();
record('CSV: mapeamento automático reconhece "Valor"', mappedValue === 'potentialValue', mappedValue);

await page.getByRole('button', { name: /Importar 2 linha/ }).click();
await page.waitForTimeout(1200);
const after = await page.locator('tbody tr').count();
record(
  'CSV: importa linhas válidas e ignora as vazias',
  after === before + 2,
  `${before} → ${after} leads`,
);

await page.getByRole('searchbox', { name: 'Buscar leads' }).fill('floricultura');
await page.waitForTimeout(500);
const importedRow = await page.locator('tbody').innerText();
record(
  'CSV: valores e etapa importados corretamente',
  importedRow.replace(/\u00a0/g, ' ').includes('R$ 2.600') && importedRow.includes('Interessado'),
  importedRow.replace(/\n/g, ' | ').slice(0, 120),
);
await page.getByRole('searchbox', { name: 'Buscar leads' }).fill('');

// --- personalização de etapas sem perder leads
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
const stageInput = page.locator('input[placeholder^="Nova etapa"]');
await stageInput.fill('Follow-up pós-proposta');
await page.getByRole('button', { name: 'Adicionar' }).first().click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Salvar etapas' }).click();
await page.waitForTimeout(900);
const stagesToast = await page.getByText('Etapas atualizadas').isVisible();
await page.goto(`${BASE}/funil`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const hasNewStage = await page.locator('section[aria-label="Etapa Follow-up pós-proposta"]').isVisible();
record('Etapas: nova etapa criada aparece no funil', stagesToast && hasNewStage);

// renomeia uma etapa existente e confirma que os leads continuam lá
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
const leadsBefore = await page.evaluate(async () => {
  const req = indexedDB.open('alinho');
  const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
  return new Promise((res) => {
    const tx = db.transaction('leads', 'readonly').objectStore('leads').getAll();
    tx.onsuccess = () => res(tx.result.filter((l) => l.dataset === 'real').length);
  });
});
const interessadoInput = page.locator('input[value="Interessado"]').first();
await interessadoInput.fill('Interessado (quente)');
await page.getByRole('button', { name: 'Salvar etapas' }).click();
await page.waitForTimeout(900);
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const leadsAfter = await page.locator('tbody tr').count();
const renamedVisible = (await page.locator('tbody').innerText()).includes('Interessado (quente)');
record(
  'Etapas: renomear preserva os leads',
  leadsAfter === leadsBefore && renamedVisible,
  `${leadsBefore} antes / ${leadsAfter} depois`,
);

// remove a etapa criada (vazia) e confirma
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Remover etapa Follow-up pós-proposta' }).click();
await page.waitForTimeout(300);
await page.getByRole('dialog').getByRole('button', { name: 'Remover etapa', exact: true }).click();
await page.waitForTimeout(900);
await page.goto(`${BASE}/funil`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const stageGone = (await page.locator('section[aria-label="Etapa Follow-up pós-proposta"]').count()) === 0;
const leadsStill = await page.evaluate(async () => {
  const req = indexedDB.open('alinho');
  const db = await new Promise((res) => { req.onsuccess = () => res(req.result); });
  return new Promise((res) => {
    const tx = db.transaction('leads', 'readonly').objectStore('leads').getAll();
    tx.onsuccess = () => res(tx.result.filter((l) => l.dataset === 'real').length);
  });
});
record('Etapas: remover etapa não apaga leads', stageGone && leadsStill === leadsBefore, `${leadsStill} leads`);

// --- funcionamento offline após o primeiro carregamento
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500); // deixa o service worker instalar e cachear
const swReady = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(reg && (reg.active || reg.installing || reg.waiting));
});
record('Service worker registrado', swReady);

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await context.setOffline(true);
await page.reload({ waitUntil: 'load' }).catch(() => undefined);
await page.waitForTimeout(1500);
const offlineWorks = await page.locator('h1').first().innerText().catch(() => '');
const offlineLeads = await page.evaluate(() =>
  document.body.innerText.includes('Leads cadastrados') || document.body.innerText.includes('primeiro lead'),
);
record(
  'Aplicação abre offline após o primeiro carregamento',
  offlineWorks.length > 0 && offlineLeads,
  `h1="${offlineWorks}"`,
);
await shot(page, '21-offline');

// navega entre páginas offline
await page.goto(`${BASE}/leads`, { waitUntil: 'load' }).catch(() => undefined);
await page.waitForTimeout(1200);
const offlineRows = await page.locator('tbody tr').count();
record('Dados locais continuam acessíveis offline', offlineRows >= 1, `${offlineRows} lead(s)`);
await context.setOffline(false);

record('Console sem erros (parte 5)', errors.filter((e) => !/Failed to fetch|ERR_INTERNET/i.test(e)).length === 0,
  errors.slice(0, 3).join(' | '));
await context.close();
summary();
