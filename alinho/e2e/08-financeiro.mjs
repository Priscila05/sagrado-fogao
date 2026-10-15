import { openApp, record, summary, shot, BASE, OUT } from './helpers.mjs';
import fs from 'node:fs';
import path from 'node:path';

// Perfil limpo: esta bateria cria todo o seu próprio estado financeiro.
const { context, page, errors } = await openApp({ fresh: true });

const money = (text) => text.replace(/ /g, ' ');
const tileValue = async (label) => {
  const tile = page.locator('a,div').filter({ hasText: new RegExp(`^${label}`) }).first();
  return money(await tile.innerText());
};

// --- navegação
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const navLink = page.getByRole('link', { name: 'Financeiro' }).first();
record('Financeiro aparece na navegação lateral', await navLink.isVisible());
await navLink.click();
await page.waitForURL('**/financeiro');
record(
  'Módulo abre com estado vazio orientando o primeiro cadastro',
  await page.getByText('Comece cadastrando um contrato').isVisible(),
);
await shot(page, '24-financeiro-vazio');

// --- CRM preservado: cria uma empresa para vincular ao contrato
await page.goto(`${BASE}/empresas`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Nova empresa' }).first().click();
await page.getByRole('textbox', { name: /Nome da empresa/ }).fill('Cantina Dona Marta');
await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar empresa' }).click();
await page.waitForTimeout(700);

// --- criação de contrato com entrada + parcelas
await page.goto(`${BASE}/financeiro/contratos`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Novo contrato' }).first().click();
await page.getByRole('textbox', { name: 'Nome do projeto' }).fill('Site institucional');
await page.getByLabel('Cliente do CRM').selectOption({ label: 'Cantina Dona Marta' });
await page.getByRole('textbox', { name: 'Valor total' }).fill('3.000,00');
await page.getByRole('textbox', { name: 'Entrada' }).fill('900,00');
await page.getByLabel('Número de parcelas').fill('3');
await page.waitForTimeout(300);
const previewText = money(await page.getByRole('dialog').innerText());
record(
  'Prévia da agenda mostra entrada e parcelas antes de salvar',
  previewText.includes('Entrada') && previewText.includes('R$ 900,00') && previewText.includes('R$ 700,00'),
  previewText.split('\n').filter((l) => l.includes('R$')).slice(0, 4).join(' | '),
);
await shot(page, '25-contrato-form');
await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar contrato' }).click();
await page.waitForTimeout(900);
record(
  'Contrato cadastrado gera a agenda automaticamente',
  await page.getByText('A agenda de pagamentos foi gerada.').isVisible(),
);

// --- agenda criada com 4 lançamentos somando o contrato
await page.goto(`${BASE}/financeiro/pagamentos`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const rowsAfterCreate = await page.locator('tbody tr').count();
const paymentsText = money(await page.locator('tbody').innerText());
record(
  'Agenda tem entrada + 3 parcelas somando o valor do contrato',
  rowsAfterCreate === 4 && paymentsText.includes('R$ 900,00') && paymentsText.includes('R$ 700,00'),
  `${rowsAfterCreate} lançamento(s)`,
);
await shot(page, '26-pagamentos');

// --- dashboard: contratado ≠ recebido
await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const contratado = await tileValue('Faturamento contratado');
const recebido = await tileValue('Total recebido');
record(
  'Dashboard separa contratado de recebido (nada recebido ainda)',
  contratado.includes('3.000') && recebido.includes('R$ 0'),
  `${contratado.replace(/\n/g, ' ')} / ${recebido.replace(/\n/g, ' ')}`,
);

// --- registrar recebimento da entrada
await page.goto(`${BASE}/financeiro/pagamentos`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Receber' }).first().click();
await page.waitForTimeout(400);
const receiveDialog = money(await page.getByRole('dialog').innerText());
await page.getByRole('dialog').getByRole('button', { name: 'Confirmar recebimento' }).click();
await page.waitForTimeout(900);
record(
  'Registro de recebimento com valor efetivamente recebido',
  receiveDialog.includes('Valor recebido') &&
    (await page.getByText('O valor entrou no total recebido.').isVisible()),
);

await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const recebidoDepois = await tileValue('Total recebido');
const aReceber = await tileValue('A receber');
record(
  'Indicadores atualizam: R$ 900 recebidos, R$ 2.100 a receber',
  recebidoDepois.includes('900') && aReceber.includes('2.100'),
  `${recebidoDepois.replace(/\n/g, ' ')} / ${aReceber.replace(/\n/g, ' ')}`,
);

// --- despesa e lucro realizado
await page.goto(`${BASE}/financeiro/despesas`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Nova despesa' }).first().click();
await page.getByRole('textbox', { name: 'Descrição' }).fill('Hospedagem anual');
await page.getByLabel('Categoria').selectOption('Hospedagem e domínio');
await page.getByRole('textbox', { name: 'Valor' }).fill('300,00');
await page.getByRole('dialog').getByRole('button', { name: 'Registrar despesa' }).click();
await page.waitForTimeout(900);
record('Despesa registrada', await page.getByText('Despesa registrada').isVisible());

// despesa prevista não deve afetar o lucro
await page.getByRole('button', { name: 'Nova despesa' }).first().click();
await page.getByRole('textbox', { name: 'Descrição' }).fill('Anúncios do próximo mês');
await page.getByRole('textbox', { name: 'Valor' }).fill('500,00');
await page.getByRole('dialog').getByLabel('Situação', { exact: true }).selectOption('prevista');
await page.getByRole('dialog').getByRole('button', { name: 'Registrar despesa' }).click();
await page.waitForTimeout(900);

await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const lucro = await tileValue('Lucro realizado');
const despesas = await tileValue('Despesas pagas');
record(
  'Lucro realizado = recebido − despesas pagas (prevista não conta)',
  lucro.includes('600') && despesas.includes('300') && despesas.includes('500 previstas'),
  `${lucro.replace(/\n/g, ' ')} / ${despesas.replace(/\n/g, ' ')}`,
);
await shot(page, '27-financeiro-dashboard');

// --- editar contrato não duplica parcelas e preserva o pago
await page.goto(`${BASE}/financeiro/contratos`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Editar Site institucional' }).click();
const totalField = page.getByRole('textbox', { name: 'Valor total' });
// espera o modal carregar os valores atuais antes de digitar
await totalField.waitFor({ state: 'visible' });
await page.waitForFunction(
  () => {
    const input = document.querySelector('[role="dialog"] input');
    return Boolean(input && input.value);
  },
  undefined,
  { timeout: 5000 },
);
await totalField.fill('4.000,00');
await page.getByRole('dialog').getByRole('button', { name: 'Salvar contrato' }).click();
await page.waitForTimeout(1000);
const editToast = await page.getByText(/Parcelas já pagas foram preservadas/).isVisible();

await page.goto(`${BASE}/financeiro/pagamentos`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const rowsAfterEdit = await page.locator('tbody tr').count();
const afterEditText = money(await page.locator('tbody').innerText());
record(
  'Editar contrato não duplica lançamentos',
  rowsAfterEdit === 4,
  `${rowsAfterCreate} antes / ${rowsAfterEdit} depois`,
);
record(
  'Parcelas em aberto recalculadas e entrada paga preservada',
  editToast &&
    afterEditText.includes('R$ 900,00') &&
    afterEditText.includes('R$ 1.033,33'),
  afterEditText.split('\n').filter((l) => l.includes('R$')).slice(0, 3).join(' | '),
);

await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const recebidoAposEdicao = await tileValue('Total recebido');
record(
  'Valor recebido não muda ao editar o contrato',
  recebidoAposEdicao.includes('900'),
  recebidoAposEdicao.replace(/\n/g, ' '),
);

// --- persistência após recarregar
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const afterReload = await tileValue('Total recebido');
record('Dados financeiros persistem após recarregar', afterReload.includes('900'), afterReload.replace(/\n/g, ' '));

// --- histórico com filtros
await page.goto(`${BASE}/financeiro/historico`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const ledgerText = money(await page.locator('#conteudo ul').last().innerText());
record(
  'Histórico reúne recebimentos e despesas',
  ledgerText.includes('Hospedagem anual') && ledgerText.includes('Entrada'),
  ledgerText.split('\n').slice(0, 3).join(' | '),
);
await page.getByRole('tab', { name: 'Despesas' }).click();
await page.waitForTimeout(400);
const onlyExpenses = money(await page.locator('#conteudo ul').last().innerText());
record(
  'Filtro por tipo isola as despesas',
  onlyExpenses.includes('Hospedagem') && !onlyExpenses.includes('Entrada'),
);
await shot(page, '28-historico-financeiro');

const [ledgerCsv] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Exportar CSV' }).click(),
]);
record('Histórico exporta CSV', (await ledgerCsv.path()) !== null, ledgerCsv.suggestedFilename());

// --- relatórios financeiros
await page.goto(`${BASE}/financeiro/relatorios`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const reportText = money(await page.locator('#conteudo').innerText());
record(
  'Relatório mostra receitas, despesas, resultado e pendentes',
  reportText.includes('Receitas') &&
    reportText.includes('Despesas') &&
    reportText.includes('Resultado') &&
    reportText.includes('Pagamentos pendentes'),
);
const [reportCsv] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Exportar CSV' }).first().click(),
]);
const reportPath = path.join(OUT, 'relatorio-financeiro.csv');
await reportCsv.saveAs(reportPath);
const csvContent = fs.readFileSync(reportPath, 'utf8');
record(
  'CSV do relatório traz receitas, despesas e pendências',
  csvContent.includes('Total recebido') &&
    csvContent.includes('Despesas por categoria') &&
    csvContent.includes('Pagamentos pendentes'),
  `${csvContent.split('\n').length} linhas`,
);
await shot(page, '29-relatorio-financeiro');

// --- backup inclui o financeiro
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
const [backup] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Exportar backup' }).click(),
]);
const backupPath = path.join(OUT, 'backup-financeiro.json');
await backup.saveAs(backupPath);
const parsed = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
record(
  'Backup v2 inclui contratos, pagamentos e despesas',
  parsed.version === 2 &&
    parsed.data.contracts.length === 1 &&
    parsed.data.payments.length === 4 &&
    parsed.data.expenses.length === 2,
  `contratos=${parsed.data.contracts.length} pagamentos=${parsed.data.payments.length} despesas=${parsed.data.expenses.length}`,
);

// --- exclusão e restauração via backup
await page.goto(`${BASE}/financeiro/contratos`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Excluir Site institucional' }).click();
const deleteDialog = money(await page.getByRole('dialog').innerText());
await page.getByRole('dialog').getByRole('button', { name: 'Excluir contrato' }).click();
await page.waitForTimeout(900);
const afterDelete = await page.getByText('Nenhum contrato cadastrado').isVisible();
record(
  'Exclusão de contrato avisa o impacto e remove a agenda',
  deleteDialog.includes('R$ 900,00') && afterDelete,
);

await page.goto(`${BASE}/financeiro/despesas`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const expensesKept = await page.locator('tbody tr').count();
record('Despesas sobrevivem à exclusão do contrato', expensesKept === 2, `${expensesKept} despesa(s)`);

await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
await page.setInputFiles('input[type="file"][accept*="json"]', backupPath);
await page.waitForTimeout(700);
const restoreDialog = money(await page.getByRole('dialog').innerText());
await page.getByRole('button', { name: 'Substituir dados atuais' }).click();
await page.waitForTimeout(1300);
await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const restored = await tileValue('Total recebido');
record(
  'Importar backup restaura o financeiro completo',
  /contratos/i.test(restoreDialog) && restored.includes('900'),
  restored.replace(/\n/g, ' '),
);

// --- backup antigo (v1) continua aceito
const legacyPath = path.join(OUT, 'backup-v1.json');
fs.writeFileSync(
  legacyPath,
  JSON.stringify({
    format: 'alinho-backup',
    version: 1,
    exportedAt: '2026-05-01T12:00:00.000Z',
    appVersion: '1.0.0',
    counts: { leads: 1, companies: 0, activities: 0, interactions: 0 },
    data: {
      leads: [
        {
          id: 'legado-1',
          contactName: 'Lead do backup antigo',
          establishmentName: 'Padaria Antiga',
          stageId: 'novo',
          dataset: 'real',
          createdAt: '2026-05-01T12:00:00.000Z',
        },
      ],
      companies: [],
      activities: [],
      interactions: [],
      settings: { id: 'app', theme: 'system', activeDataset: 'real' },
    },
  }),
);
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
await page.setInputFiles('input[type="file"][accept*="json"]', legacyPath);
await page.waitForTimeout(700);
const legacyDialog = money(await page.getByRole('dialog').innerText());
await page.getByRole('button', { name: 'Substituir dados atuais' }).click();
await page.waitForTimeout(1300);
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const legacyLead = await page.getByText('Padaria Antiga').first().isVisible();
await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const emptyFinance = await page.getByText('Comece cadastrando um contrato').isVisible();
record(
  'Backup da versão 1 importa o CRM e deixa o financeiro vazio',
  legacyLead && emptyFinance && /contratos/i.test(legacyDialog),
  `lead antigo=${legacyLead} financeiro vazio=${emptyFinance}`,
);

record(
  'Console sem erros (financeiro)',
  errors.length === 0,
  errors.slice(0, 3).join(' | '),
);
await context.close();
summary();
