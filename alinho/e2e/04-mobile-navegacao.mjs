import { openApp, record, summary, shot, BASE } from './helpers.mjs';

// 18 — layout mobile (375 px) e 320 px
let { context, page, errors } = await openApp({ fresh: false, viewport: { width: 375, height: 760 } });

const overflowAt = async (url) => {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  return page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
};

const routes = ['/', '/leads', '/funil', '/empresas', '/atividades', '/relatorios', '/configuracoes'];
let overflowProblems = [];
for (const route of routes) {
  const { doc, win } = await overflowAt(route);
  if (doc > win + 1) overflowProblems.push(`${route} (${doc}>${win})`);
}
record('18a. Sem rolagem horizontal em 375 px', overflowProblems.length === 0, overflowProblems.join(', '));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const tabBar = page.getByRole('navigation', { name: 'Navegação rápida' });
record('18b. Barra de navegação compacta no celular', await tabBar.isVisible());
await shot(page, '08-mobile-dashboard');

// menu lateral em drawer
await page.getByRole('button', { name: 'Abrir menu' }).click();
await page.waitForTimeout(350);
const drawer = page.getByRole('dialog', { name: 'Menu de navegação' });
record('18c. Menu lateral abre como drawer', await drawer.isVisible());
await shot(page, '09-mobile-menu');
await page.getByRole('button', { name: 'Fechar menu' }).click();
await page.waitForTimeout(300);

// funil navegável por rolagem horizontal no celular
await page.goto(`${BASE}/funil`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const scroller = page.locator('div.overflow-x-auto').first();
const scrollable = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth + 10);
record('18d. Funil rolável horizontalmente no celular', scrollable);
await shot(page, '10-mobile-funil');

await context.close();

// 320 px
({ context, page, errors } = await openApp({ fresh: false, viewport: { width: 320, height: 640 } }));
overflowProblems = [];
for (const route of routes) {
  const { doc, win } = await overflowAt(route);
  if (doc > win + 1) overflowProblems.push(`${route} (${doc}>${win})`);
}
record('18e. Sem rolagem horizontal em 320 px', overflowProblems.length === 0, overflowProblems.join(', '));
await shot(page, '11-mobile-320');
await context.close();

// 19 — navegação completa entre páginas, mantendo os dados
({ context, page, errors } = await openApp({ fresh: false }));
const expected = [
  ['/', 'Bom acompanhamento começa aqui'],
  ['/leads', 'Leads'],
  ['/funil', 'Funil de vendas'],
  ['/empresas', 'Empresas e clientes'],
  ['/atividades', 'Atividades e follow-ups'],
  ['/relatorios', 'Relatórios'],
  ['/configuracoes', 'Preferências e dados'],
];
const navProblems = [];
for (const [route, heading] of expected) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const h1 = await page.locator('h1').first().innerText();
  if (!h1.includes(heading)) navProblems.push(`${route}: "${h1}"`);
}
record('19b. Todas as páginas abrem por URL própria (deep link)', navProblems.length === 0, navProblems.join(' | '));

// rota inexistente
await page.goto(`${BASE}/rota-que-nao-existe`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
record(
  '19c. Rota inexistente mostra página 404',
  (await page.getByText('Página não encontrada').isVisible()) && page.url().includes('/404'),
);

// 11 — dashboard atualizado com os dados reais
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const tiles = await page.locator('section[aria-label="Indicadores principais"]').innerText();
const agenda = await page.locator('section[aria-label="Indicadores de agenda"]').innerText();
record(
  '11b. Dashboard mostra totais, conversão e agenda a partir dos registros',
  tiles.includes('Leads cadastrados') && tiles.includes('2') && agenda.includes('Taxa de conversão'),
  tiles.replace(/\n+/g, ' | ').slice(0, 140),
);
await shot(page, '12-dashboard-desktop');

// relatórios com dados reais
await page.goto(`${BASE}/relatorios`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const reportText = await page.locator('#conteudo').innerText();
record(
  'Relatórios calculam origem e segmento reais',
  reportText.includes('Origem dos leads') && reportText.includes('Prospecção ativa'),
  reportText.split('\n').filter((l) => l.includes('Prospecção')).slice(0, 2).join(' | '),
);
const [reportDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Exportar CSV' }).click(),
]);
record('Relatório exporta CSV', (await reportDownload.path()) !== null, reportDownload.suggestedFilename());
await shot(page, '13-relatorios');

// exportação CSV de leads
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
const [csvDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Exportar CSV' }).click(),
]);
record('Exportação CSV de leads', (await csvDownload.path()) !== null, csvDownload.suggestedFilename());

// modo demonstração isolado dos dados reais
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Explorar demonstração|Recriar demonstração/ }).click();
await page.waitForTimeout(1500);
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const demoRows = await page.locator('tbody tr').count();
const demoText = await page.locator('tbody').innerText();
record(
  'Demonstração carrega dados fictícios marcados',
  demoRows >= 10 && demoText.includes('(demo)'),
  `${demoRows} linha(s)`,
);
await shot(page, '14-demo-leads');

await page.goto(`${BASE}/funil`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await shot(page, '15-demo-funil');
await page.goto(`${BASE}/relatorios`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot(page, '16-demo-relatorios');

// volta para os dados reais e confere que nada se misturou
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: /Meus dados/ }).click();
await page.waitForTimeout(900);
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const realRows = await page.locator('tbody tr').count();
const realText = await page.locator('tbody').innerText();
record(
  'Dados reais permanecem separados da demonstração',
  realRows === 2 && !realText.includes('(demo)'),
  `${realRows} lead(s) reais`,
);

// tema escuro
await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
await page.getByRole('tab', { name: 'Escuro' }).click();
await page.waitForTimeout(400);
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
record('Modo escuro aplicado', theme === 'dark', String(theme));
await shot(page, '17-tema-escuro');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
const themeKept = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
record('Preferência de tema mantida entre páginas', themeKept === 'dark');
await shot(page, '18-dashboard-escuro');
await page.getByRole('link', { name: 'Modo claro' }).first().isVisible().catch(() => false);

record('Console sem erros (parte 3)', errors.length === 0, errors.slice(0, 3).join(' | '));
await context.close();
summary();
