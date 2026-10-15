import { chromium } from 'playwright';
import { record, summary, BASE, OUT } from './helpers.mjs';
import path from 'node:path';

/**
 * Compatibilidade com instalações anteriores ao módulo financeiro: um banco
 * local já existente na versão 1 precisa migrar para a versão 2 sem perder
 * nada, apenas ganhando as lojas novas.
 */
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Antes de carregar o aplicativo, cria um banco no formato antigo (versão 1).
  await page.goto(`${BASE}/404`, { waitUntil: 'networkidle' });
  const seeded = await page.evaluate(async () => {
    await new Promise((resolve) => {
      const del = indexedDB.deleteDatabase('alinho');
      del.onsuccess = resolve;
      del.onerror = resolve;
      del.onblocked = resolve;
    });
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('alinho', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of ['leads', 'companies', 'activities', 'interactions', 'settings']) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['leads', 'settings'], 'readwrite');
        tx.objectStore('leads').put({
          id: 'legado-1',
          contactName: 'Cliente Antigo',
          establishmentName: 'Padaria da Esquina',
          stageId: 'novo',
          dataset: 'real',
          priority: 'media',
          potentialValue: 1500,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        tx.objectStore('settings').put({
          id: 'app',
          theme: 'system',
          activeDataset: 'real',
          sources: ['Indicação'],
          segments: ['Restaurante'],
        });
        tx.oncomplete = () => {
          const version = db.version;
          const stores = Array.from(db.objectStoreNames);
          db.close();
          resolve({ version, stores });
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  record(
    'Banco antigo criado na versão 1 (sem lojas do financeiro)',
    seeded.version === 1 && !seeded.stores.includes('contracts'),
    `v${seeded.version}: ${seeded.stores.join(', ')}`,
  );

  // Agora o aplicativo novo abre sobre esse banco.
  await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const legacyLead = await page.getByText('Padaria da Esquina').first().isVisible();
  record('Dados do CRM sobrevivem à migração', legacyLead);

  const upgraded = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('alinho');
        request.onsuccess = () => {
          const db = request.result;
          const info = { version: db.version, stores: Array.from(db.objectStoreNames) };
          db.close();
          resolve(info);
        };
      }),
  );
  record(
    'Banco migrado para a versão 2 com as lojas do financeiro',
    upgraded.version === 2 &&
      ['contracts', 'payments', 'expenses'].every((store) => upgraded.stores.includes(store)),
    `v${upgraded.version}: ${upgraded.stores.join(', ')}`,
  );

  // As listas novas de configuração entram com os padrões.
  await page.goto(`${BASE}/configuracoes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const settingsText = await page.locator('#conteudo').innerText();
  record(
    'Configurações antigas ganham as listas do financeiro',
    settingsText.includes('Categorias de despesa') &&
      settingsText.includes('Formas de pagamento') &&
      settingsText.includes('Hospedagem e domínio') &&
      settingsText.includes('Indicação'),
  );

  // O financeiro funciona normalmente sobre o banco migrado.
  await page.goto(`${BASE}/financeiro/contratos`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Novo contrato' }).first().click();
  await page.getByRole('textbox', { name: 'Nome do projeto' }).fill('Cardápio digital');
  await page.getByRole('textbox', { name: 'Cliente' }).last().fill('Padaria da Esquina');
  await page.getByRole('textbox', { name: 'Valor total' }).fill('1.200,00');
  await page.getByLabel('Número de parcelas').fill('2');
  await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar contrato' }).click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/financeiro/pagamentos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const rows = await page.locator('tbody tr').count();
  record('Financeiro funciona sobre o banco migrado', rows === 2, `${rows} parcela(s)`);
  await page.screenshot({ path: path.join(OUT, '30-migracao.png') });

  await context.close();
  await browser.close();
}

// Layout responsivo das telas do financeiro.
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const routes = [
    '/financeiro',
    '/financeiro/contratos',
    '/financeiro/pagamentos',
    '/financeiro/despesas',
    '/financeiro/historico',
    '/financeiro/relatorios',
  ];
  for (const width of [320, 375, 768]) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    const problems = [];
    for (const route of routes) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(350);
      const info = await page.evaluate(() => {
        const main = document.querySelector('#conteudo');
        window.scrollTo(300, 0);
        const panned = window.scrollX;
        window.scrollTo(0, 0);
        return {
          html: document.documentElement.scrollWidth,
          win: window.innerWidth,
          mainSW: main?.scrollWidth ?? 0,
          mainCW: main?.clientWidth ?? 0,
          panned,
        };
      });
      if (info.panned > 0 || info.html > info.win + 1 || info.mainSW > info.mainCW + 1) {
        problems.push(`${route} (${info.html}/${info.mainSW}>${info.win})`);
      }
    }
    record(`Financeiro sem estouro horizontal em ${width} px`, problems.length === 0, problems.join(', '));
    if (width === 375) {
      await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, '31-financeiro-mobile.png') });
    }
    await context.close();
  }
  await browser.close();
}

summary();
