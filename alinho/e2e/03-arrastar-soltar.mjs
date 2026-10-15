import { openApp, record, summary, shot, BASE } from './helpers.mjs';
const { context, page, errors } = await openApp({ fresh: false });
await page.goto(`${BASE}/funil`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const colOf = (name) => page.locator(`section[aria-label="Etapa ${name}"]`);
const whereIs = async () => {
  const names = ['Novo lead', 'Primeiro contato', 'Contato realizado', 'Interessado',
    'Reunião agendada', 'Proposta enviada', 'Negociação', 'Ganho', 'Perdido'];
  const found = [];
  for (const n of names) {
    const c = await colOf(n).getByRole('article').count();
    if (c > 0) found.push(`${n}:${c}`);
  }
  return found.join(', ');
};

console.log('antes do arraste →', await whereIs());

// arrasta o cartão de "Proposta enviada" para "Reunião agendada"
const card = colOf('Proposta enviada').getByRole('article').first();
const target = colOf('Reunião agendada');
// Playwright's dragTo dispatches real HTML5 drag events (synthetic mouse moves
// do not start a native drag in Chromium).
await card.dragTo(target, { targetPosition: { x: 130, y: 90 } });
await page.waitForTimeout(900);
await shot(page, '07-apos-arraste');

const after = await whereIs();
console.log('depois do arraste →', after);
record(
  '9b. Arrastar e soltar move a oportunidade de coluna',
  (await colOf('Reunião agendada').getByRole('article').count()) === 1 &&
    (await colOf('Proposta enviada').getByRole('article').count()) === 0,
  after,
);

// confirma persistência da etapa após recarregar
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(500);
record(
  '9d. Etapa persistida após recarregar',
  (await colOf('Reunião agendada').getByRole('article').count()) === 1,
  await whereIs(),
);

// histórico registrou a mudança de etapa
await colOf('Reunião agendada').getByRole('article').first().getByRole('link').first().click();
await page.waitForURL(/\/leads\/[0-9a-f-]+/i);
const hist = await page.locator('ol').last().innerText();
record(
  '12d. Histórico registra mudança de etapa',
  hist.includes('Etapa alterada'),
  hist.split('\n').filter((l) => l.includes('Etapa')).slice(0, 2).join(' | '),
);
record('Console sem erros (DnD)', errors.length === 0, errors.slice(0, 3).join(' | '));
await context.close();
summary();
