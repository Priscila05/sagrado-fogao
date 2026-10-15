import { openApp, record, summary, shot } from './helpers.mjs';

const { context, page, errors } = await openApp({ fresh: true });

// 1 — primeiro acesso, sem dados
const emptyTitle = page.getByText('Comece cadastrando seu primeiro lead');
record('1. Primeiro acesso mostra estado vazio', await emptyTitle.isVisible());
await shot(page, '01-vazio');

// 2 — cadastro de lead
await page.getByRole('button', { name: 'Cadastrar lead' }).click();
await page.getByLabel('Nome do contato').fill('Ana Ribeiro');
await page.getByLabel('Estabelecimento').fill('Pet Shop Patas Felizes');
await page.getByLabel('Segmento').selectOption('Pet shop');
await page.getByLabel('Origem do lead').selectOption('Prospecção ativa');
await page.getByLabel('Telefone').fill('4133334444');
await page.getByLabel('WhatsApp').fill('41999998888');
await page.getByLabel('E-mail').fill('ana@petpatas.com.br');
await page.getByLabel('Instagram').fill('@petpatasfelizes');
await page.getByLabel('Site').fill('petpatas.com.br');
await page.getByLabel('Bairro').fill('Água Verde');
await page.getByLabel('Cidade').fill('Curitiba');
await page.getByLabel('Valor potencial').fill('2.400,00');
await page.getByLabel('Prioridade').selectOption('alta');
await page.getByRole('button', { name: 'Cadastrar lead' }).last().click();
await page.waitForTimeout(600);
const toastOk = await page.getByText('Lead cadastrado').isVisible();
const tileLeads = await page.locator('a', { hasText: 'Leads cadastrados' }).first().innerText();
record('2. Cadastro de lead', toastOk && tileLeads.includes('1'), tileLeads.replace(/\n/g, ' | '));
await shot(page, '02-dashboard-1-lead');

// 11 — dashboard reflete o cadastro
const pipelineTile = await page.locator('a', { hasText: 'Em andamento' }).first().innerText();
record(
  '11a. Dashboard calcula valor do funil a partir do lead real',
  pipelineTile.includes('2.400'),
  pipelineTile.replace(/\n/g, ' | '),
);

// 19 — navegação entre páginas com URLs próprias
await page.getByRole('link', { name: 'Leads' }).first().click();
await page.waitForURL('**/leads');
const leadVisible = await page.getByRole('link', { name: 'Pet Shop Patas Felizes' }).first().isVisible();
record('19a. Navegação para /leads', page.url().endsWith('/leads') && leadVisible);

// 17 — links de contato reais
await page.getByRole('link', { name: 'Pet Shop Patas Felizes' }).first().click();
await page.waitForURL(/\/leads\/[0-9a-f-]+/i);
const tel = await page.getByRole('link', { name: 'Ligar' }).getAttribute('href');
const whats = await page.getByRole('link', { name: 'WhatsApp' }).getAttribute('href');
const mail = await page.getByRole('link', { name: 'E-mail' }).getAttribute('href');
const site = await page.getByRole('link', { name: 'Site' }).getAttribute('href');
const insta = await page.getByRole('link', { name: 'Instagram' }).getAttribute('href');
record(
  '17. Links de telefone, WhatsApp, e-mail, site e Instagram',
  tel === 'tel:+554133334444' &&
    whats === 'https://wa.me/5541999998888' &&
    mail === 'mailto:ana@petpatas.com.br' &&
    site === 'https://petpatas.com.br/' &&
    insta === 'https://instagram.com/petpatasfelizes',
  [tel, whats, mail, site, insta].join(' '),
);
await shot(page, '03-lead-detalhe');

// 12 — histórico automático na criação
const history = await page.locator('ol').last().innerText();
record(
  '12a. Histórico registra criação do lead automaticamente',
  history.includes('Lead criado na etapa'),
  history.split('\n').slice(0, 3).join(' | '),
);

// 3 — edição de lead
await page.getByRole('button', { name: 'Editar' }).first().click();
await page.getByLabel('Estabelecimento').fill('Pet Shop Patas Felizes — Matriz');
await page.getByLabel('Valor potencial').fill('3.100,00');
await page.getByRole('button', { name: 'Salvar alterações' }).click();
await page.waitForTimeout(500);
const editedTitle = await page.locator('h1').innerText();
record('3. Edição de lead', editedTitle.includes('Matriz'), editedTitle);

// 10 — criação e conclusão de atividade
await page.getByRole('button', { name: 'Agendar follow-up' }).click();
await page.getByRole('textbox', { name: 'Atividade' }).fill('Retornar ligação para a Ana');
await page.getByLabel('Tipo').selectOption('ligacao');
await page.getByRole('button', { name: 'Criar atividade' }).click();
await page.waitForTimeout(500);
const activityCreated = await page.getByText('Retornar ligação para a Ana').first().isVisible();
record('10a. Criação de atividade vinculada ao lead', activityCreated);

const activityBox = page.getByRole('checkbox', { name: /Concluir Retornar liga/ });
await activityBox.click();
await page.waitForTimeout(800);
const doneToast = await page.getByText('Atividade concluída').first().isVisible();
record('10b. Conclusão de atividade', doneToast && (await activityBox.isChecked()));

// 12 — histórico recebe a conclusão
await page.reload({ waitUntil: 'networkidle' });
const history2 = await page.locator('ol').last().innerText();
record(
  '12b. Histórico registra conclusão da atividade',
  history2.includes('Atividade concluída'),
  history2.split('\n').slice(0, 4).join(' | '),
);

// 5 — persistência após atualizar a página
const titleAfterReload = await page.locator('h1').innerText();
record('5. Persistência após recarregar a página', titleAfterReload.includes('Matriz'), titleAfterReload);

// registro manual de interação (§10: só o que o usuário confirma)
await page.getByRole('button', { name: 'Registrar interação' }).click();
await page.getByLabel('Tipo de interação').selectOption('ligacao_realizada');
await page.getByLabel('Descrição').fill('Falei com a Ana, pediu proposta até sexta.');
await page.getByRole('button', { name: 'Registrar' }).last().click();
await page.waitForTimeout(500);
const history3 = await page.locator('ol').last().innerText();
record(
  '12c. Interação manual entra na linha do tempo',
  history3.includes('pediu proposta'),
  history3.split('\n').slice(0, 3).join(' | '),
);

record('Console sem erros até aqui', errors.length === 0, errors.slice(0, 3).join(' | '));
await context.close();
summary();
