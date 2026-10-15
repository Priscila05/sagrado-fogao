import { openApp, record, summary, shot, OUT, BASE } from './helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';

const { context, page, errors } = await openApp({ fresh: false });

// 6 — persistência após fechar e reabrir a aplicação (perfil reaberto)
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
const survived = await page.getByRole('link', { name: /Pet Shop Patas Felizes/ }).first().isVisible();
record('6. Persistência após fechar e reabrir o navegador', survived);

// 7 — criação e edição de empresa
await page.goto(`${BASE}/empresas`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Nova empresa' }).first().click();
await page.getByRole('textbox', { name: /Nome da empresa/ }).fill('Cantina Dona Marta');
await page.getByLabel('Segmento').selectOption('Restaurante');
await page.getByLabel('Telefone').fill('4132221111');
await page.getByLabel('Cidade').fill('Curitiba');
await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar empresa' }).click();
await page.waitForTimeout(600);
const companyCreated = await page.getByText('Cantina Dona Marta').first().isVisible();
record('7a. Criação de empresa', companyCreated);

await page.getByText('Cantina Dona Marta').first().click();
await page.waitForURL(/\/empresas\/[0-9a-f-]+/i);
await page.getByRole('button', { name: 'Editar' }).click();
await page.getByRole('textbox', { name: /Nome da empresa/ }).fill('Cantina Dona Marta Ltda');
await page.getByRole('button', { name: 'Salvar alterações' }).click();
await page.waitForTimeout(600);
record('7b. Edição de empresa', (await page.locator('h1').innerText()).includes('Ltda'));

// 8 — associação entre leads e empresas
await page.getByRole('button', { name: 'Vincular lead' }).first().click();
await page.getByLabel('Lead sem empresa').selectOption({ index: 1 });
await page.getByRole('button', { name: 'Vincular' }).last().click();
await page.waitForTimeout(700);
const linked = await page.getByRole('link', { name: /Ana Ribeiro|Pet Shop/ }).first().isVisible();
record('8. Associação entre lead e empresa', linked);
await shot(page, '04-empresa-detalhe');

// 9 — mudança de etapa no funil (seletor acessível)
await page.goto(`${BASE}/funil`, { waitUntil: 'networkidle' });
const cardSelect = page.locator('article select').first();
await cardSelect.selectOption('proposta-enviada');
await page.waitForTimeout(700);
const movedToast = await page.getByText('Etapa atualizada').first().isVisible();
const propostaColumn = page.locator('section', { hasText: 'Proposta enviada' }).first();
record(
  '9a. Mudança de etapa pelo seletor do cartão',
  movedToast && (await propostaColumn.getByRole('article').count()) >= 1,
);
await shot(page, '05-funil');

// 9b — arrastar e soltar entre colunas
const card = page.getByRole('article').first();
const target = page.locator('section', { hasText: 'Negociação' }).first();
const from = await card.boundingBox();
const to = await target.boundingBox();
if (from && to) {
  await page.mouse.move(from.x + from.width / 2, from.y + 12);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(800);
}
const negociacaoText = await page.locator('section', { hasText: 'Negociação' }).first().innerText();
record(
  '9b. Arrastar e soltar entre colunas',
  negociacaoText.includes('Pet Shop'),
  negociacaoText.split('\n').slice(0, 4).join(' | '),
);

// 9c — visualização em lista como alternativa
await page.getByRole('tab', { name: 'Lista' }).click();
await page.waitForTimeout(300);
record('9c. Visualização em lista do funil', await page.getByRole('table').isVisible());

// 16 — filtros e pesquisa
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Novo lead' }).first().click();
await page.getByLabel('Nome do contato').fill('Rafael Dias');
await page.getByLabel('Estabelecimento').fill('Barbearia Navalha de Ouro');
await page.getByLabel('Segmento').selectOption('Beleza e estética');
await page.getByLabel('Origem do lead').selectOption('Instagram');
await page.getByLabel('Cidade').fill('São José dos Pinhais');
await page.getByLabel('Prioridade').selectOption('baixa');
await page.getByRole('button', { name: 'Cadastrar lead' }).last().click();
await page.waitForTimeout(700);

await page.getByRole('searchbox', { name: 'Buscar leads' }).fill('navalha');
await page.waitForTimeout(500);
const searchRows = await page.locator('tbody tr').count();
record('16a. Busca por texto', searchRows === 1, `${searchRows} linha(s)`);

await page.getByRole('searchbox', { name: 'Buscar leads' }).fill('4133334444');
await page.waitForTimeout(500);
const phoneRows = await page.locator('tbody tr').count();
record('16b. Busca por telefone', phoneRows === 1, `${phoneRows} linha(s)`);

await page.getByRole('searchbox', { name: 'Buscar leads' }).fill('');
await page.getByRole('button', { name: /Filtros/ }).click();
await page.getByLabel('Prioridade').selectOption('baixa');
await page.waitForTimeout(500);
const filteredRows = await page.locator('tbody tr').count();
record('16c. Filtro por prioridade', filteredRows === 1, `${filteredRows} linha(s)`);
await page.getByRole('button', { name: 'Limpar' }).click();
await page.waitForTimeout(300);
record('16d. Limpar filtros', (await page.locator('tbody tr').count()) === 2);
await shot(page, '06-leads-lista');

// 13 — exportação de JSON
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Exportar backup' }).click(),
]);
const backupPath = path.join(OUT, 'backup.json');
await download.saveAs(backupPath);
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
record(
  '13. Exportação de backup JSON',
  backup.format === 'alinho-backup' &&
    backup.version === 2 &&
    backup.data.leads.length === 2 &&
    backup.data.companies.length === 1 &&
    backup.data.interactions.length > 0,
  `v${backup.version} leads=${backup.data.leads.length} empresas=${backup.data.companies.length} hist=${backup.data.interactions.length}`,
);
await page.waitForTimeout(400);
const backupNoted = await page.getByText(/Último backup exportado em/).isVisible();
record('13b. Data do último backup registrada', backupNoted);

// 15 — rejeição de backup inválido
const invalidPath = path.join(OUT, 'invalido.json');
fs.writeFileSync(invalidPath, JSON.stringify({ format: 'outro-sistema', version: 1, data: {} }));
await page.setInputFiles('input[type="file"][accept*="json"]', invalidPath);
await page.waitForTimeout(600);
const rejected = await page.getByRole('alert').first().innerText();
record(
  '15a. Rejeição de backup de outro formato',
  rejected.includes('não é um backup do ALINHO'),
  rejected,
);

const brokenPath = path.join(OUT, 'quebrado.json');
fs.writeFileSync(brokenPath, '{ não é json');
await page.setInputFiles('input[type="file"][accept*="json"]', brokenPath);
await page.waitForTimeout(600);
const rejected2 = await page.getByRole('alert').first().innerText();
record('15b. Rejeição de JSON malformado', rejected2.includes('JSON'), rejected2);

// 14 — importação de JSON (remove um lead antes, para provar a substituição)
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.getByRole('link', { name: /Barbearia Navalha/ }).first().click();
await page.waitForURL(/\/leads\/[0-9a-f-]+/i);
await page.getByRole('button', { name: 'Excluir' }).first().click();
const dialogText = await page.getByRole('dialog').innerText();
await page.getByRole('button', { name: 'Excluir lead' }).click();
await page.waitForTimeout(800);
const afterDelete = await page.locator('tbody tr').count();
record(
  '4. Exclusão com confirmação',
  dialogText.includes('definitivamente') && afterDelete === 1,
  `${afterDelete} lead(s) restante(s)`,
);

await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
await page.setInputFiles('input[type="file"][accept*="json"]', backupPath);
await page.waitForTimeout(600);
const confirmText = await page.getByRole('dialog').innerText();
await page.getByRole('button', { name: 'Substituir dados atuais' }).click();
await page.waitForTimeout(1200);
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
const restored = await page.locator('tbody tr').count();
record(
  '14. Importação de backup JSON restaura os registros',
  restored === 2 && confirmText.includes('apaga os dados atuais'),
  `${restored} lead(s) após importar`,
);

record('Console sem erros (parte 2)', errors.length === 0, errors.slice(0, 3).join(' | '));
await context.close();
summary();
