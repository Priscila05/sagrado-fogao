import { chromium } from 'playwright';
import { record, summary, BASE, OUT } from './helpers.mjs';
import path from 'node:path';

// --- armazenamento bloqueado pelo navegador (ex.: janela privada restritiva)
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    // Simula um navegador que recusa o IndexedDB.
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      get() {
        return {
          open() {
            const request = {};
            setTimeout(() => request.onerror && request.onerror(new Event('error')), 0);
            return request;
          },
        };
      },
    });
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const warned = await page.getByRole('alert').first().innerText().catch(() => '');
  const stillUsable = await page.locator('h1').first().isVisible();
  record(
    'Armazenamento bloqueado: avisa e continua utilizável',
    warned.includes('bloqueou o armazenamento') && stillUsable,
    warned.slice(0, 90),
  );

  // o aplicativo continua funcionando em memória
  await page.getByRole('button', { name: 'Cadastrar lead' }).first().click();
  await page.getByRole('textbox', { name: 'Estabelecimento' }).fill('Teste em memória');
  await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar lead' }).click();
  await page.waitForTimeout(800);
  const created = await page.getByText('Lead cadastrado').isVisible();
  record('Armazenamento bloqueado: cadastro ainda funciona na sessão', created);
  await page.screenshot({ path: path.join(OUT, '22-sem-armazenamento.png') });
  await context.close();
  await browser.close();
}

// --- layout em tablet
{
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const [label, width] of [['tablet retrato', 768], ['tablet paisagem', 1024]]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage();
    const problems = [];
    for (const route of ['/', '/leads', '/funil', '/empresas', '/atividades', '/relatorios', '/configuracoes']) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(350);
      const info = await page.evaluate(() => {
        const main = document.querySelector('#conteudo');
        return {
          html: document.documentElement.scrollWidth,
          win: window.innerWidth,
          mainSW: main?.scrollWidth ?? 0,
          mainCW: main?.clientWidth ?? 0,
        };
      });
      if (info.html > info.win + 1 || info.mainSW > info.mainCW + 1) {
        problems.push(`${route} (${info.html}/${info.mainSW}>${info.win})`);
      }
    }
    record(`Layout sem estouro em ${label} (${width} px)`, problems.length === 0, problems.join(', '));
    if (width === 768) await page.screenshot({ path: path.join(OUT, '23-tablet.png') });
    await context.close();
  }
  await browser.close();
}
summary();
