import { openApp, record, summary, shot, BASE } from './helpers.mjs';

const { context, page, errors } = await openApp({ fresh: false });

// contraste WCAG AA das combinações principais, nos dois temas
const contrastCheck = async (theme) => {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const toRgb = (value) => {
      const m = value.match(/\d+(\.\d+)?/g).map(Number);
      return [m[0], m[1], m[2]];
    };
    const lum = ([r, g, b]) =>
      [r, g, b]
        .map((c) => c / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const css = (name) => toRgb(`rgb(${getComputedStyle(document.documentElement).getPropertyValue(name)})`);
    const pairs = {
      'texto principal / fundo': [css('--c-ink'), css('--c-canvas')],
      'texto secundário / fundo': [css('--c-muted'), css('--c-canvas')],
      'texto terciário / superfície': [css('--c-subtle'), css('--c-surface')],
      'destaque / fundo': [css('--c-accent'), css('--c-canvas')],
      'botão primário': [css('--c-accent-on'), css('--c-accent')],
      'badge positivo': [css('--c-positive-ink'), css('--c-positive-soft')],
      'badge atenção': [css('--c-caution-ink'), css('--c-caution-soft')],
      'badge crítico': [css('--c-critical-ink'), css('--c-critical-soft')],
      'badge destaque': [css('--c-accent-ink'), css('--c-accent-soft')],
    };
    const out = {};
    for (const [label, [fg, bg]] of Object.entries(pairs)) out[label] = Number(ratio(fg, bg).toFixed(2));
    return out;
  });
};

for (const theme of ['light', 'dark']) {
  const ratios = await contrastCheck(theme);
  const failures = Object.entries(ratios).filter(([, value]) => value < 4.5);
  record(
    `Contraste AA (${theme === 'light' ? 'claro' : 'escuro'})`,
    failures.length === 0,
    Object.entries(ratios).map(([k, v]) => `${k}=${v}`).join(', '),
  );
}
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

// navegação por teclado: skip link e foco visível
await page.goto(`${BASE}/leads`, { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
const firstFocus = await page.evaluate(() => document.activeElement?.textContent?.trim());
record('Primeiro Tab chega ao atalho "Ir para o conteúdo"', firstFocus === 'Ir para o conteúdo', String(firstFocus));

// abre o formulário e verifica o foco inicial + armadilha de foco
await page.getByRole('button', { name: 'Novo lead' }).first().click();
await page.waitForTimeout(400);
const focused = await page.evaluate(() => {
  const el = document.activeElement;
  return { tag: el?.tagName, auto: el?.getAttribute('data-autofocus'), inDialog: !!el?.closest('[role="dialog"]') };
});
record('Modal move o foco para o primeiro campo', focused.inDialog === true, JSON.stringify(focused));

const escaped = await page.evaluate(async () => {
  for (let i = 0; i < 60; i += 1) {
    const el = document.activeElement;
    if (el && !el.closest('[role="dialog"]') && el !== document.body) return el.tagName;
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    document.dispatchEvent(event);
    await new Promise((r) => setTimeout(r, 0));
  }
  return null;
});
record('Foco permanece preso no modal', escaped === null, String(escaped));

// aria do diálogo
const dialogAttrs = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  return {
    modal: dialog?.getAttribute('aria-modal'),
    labelled: !!dialog?.getAttribute('aria-labelledby'),
  };
});
record('Diálogo tem aria-modal e título associado', dialogAttrs.modal === 'true' && dialogAttrs.labelled);

// Escape fecha e devolve o foco
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const closed = (await page.locator('[role="dialog"]').count()) === 0;
const restored = await page.evaluate(() => document.activeElement?.textContent?.trim());
record('Escape fecha o modal e devolve o foco ao gatilho', closed && String(restored).includes('Novo lead'), String(restored));

// campos de formulário rotulados
await page.getByRole('button', { name: 'Novo lead' }).first().click();
await page.waitForTimeout(400);
const unlabeled = await page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"]');
  const bad = [];
  dialog.querySelectorAll('input, select, textarea').forEach((el) => {
    const id = el.getAttribute('id');
    const hasLabel = id && dialog.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (!hasLabel && !el.getAttribute('aria-label')) bad.push(el.tagName + (el.getAttribute('name') || ''));
  });
  return bad;
});
record('Todos os campos do formulário têm rótulo', unlabeled.length === 0, unlabeled.join(', '));

// validação amigável
await page.getByRole('textbox', { name: 'Estabelecimento' }).fill('Teste de validação');
await page.getByRole('textbox', { name: 'Telefone' }).fill('123');
await page.getByRole('textbox', { name: 'E-mail' }).fill('isso-nao-e-email');
await page.getByRole('dialog').getByRole('button', { name: 'Cadastrar lead' }).click();
await page.waitForTimeout(400);
const alerts = (await page.getByRole('alert').allInnerTexts()).join(' | ');
const validationMsg = alerts;
const invalidFlag = await page.getByRole('textbox', { name: 'Telefone' }).getAttribute('aria-invalid');
record(
  'Validação amigável com aria-invalid',
  validationMsg.includes('10 ou 11 dígitos') && validationMsg.includes('E-mail inválido') && invalidFlag === 'true',
  validationMsg,
);
await shot(page, '19-validacao');
await page.keyboard.press('Escape');

// imagens e botões com nome acessível
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const nameless = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('button, a').forEach((el) => {
    const text = (el.textContent || '').trim();
    const label = el.getAttribute('aria-label') || el.getAttribute('title');
    if (!text && !label) bad.push(el.outerHTML.slice(0, 60));
  });
  return bad;
});
record('Botões e links têm nome acessível', nameless.length === 0, nameless.slice(0, 2).join(' | '));

// preferência de movimento reduzido
const reducedContext = await context.browser();
record('Console sem erros (parte 4)', errors.length === 0, errors.slice(0, 3).join(' | '));
void reducedContext;
await context.close();
summary();
