import { chromium } from 'playwright';
import { record, summary, OUT } from './helpers.mjs';
import path from 'node:path';

/**
 * Modo equipe: build gerado com VITE_SUPABASE_URL/KEY apontando para um
 * servidor que não existe. Verifica o portão de login, as mensagens de erro e
 * que nenhum dado aparece sem autenticação — sem depender de um projeto real.
 */
const BASE = process.env.ALINHO_E2E_BASE || 'http://localhost:4281';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

record(
  'Build com Supabase configurado exige login',
  (await page.getByRole('heading', { name: 'Entrar' }).isVisible()) &&
    (await page.getByLabel('E-mail').isVisible()) &&
    (await page.getByLabel('Senha').isVisible()),
);
await page.screenshot({ path: path.join(OUT, '32-login.png') });

record(
  'Nenhum dado do CRM aparece antes de entrar',
  (await page.getByRole('navigation', { name: 'Navegação principal' }).count()) === 0 &&
    !(await page.locator('body').innerText()).includes('Leads cadastrados'),
);

record(
  'Página deixa claro que não há cadastro aberto',
  (await page.locator('body').innerText()).includes('o administrador da empresa cria os acessos'),
);

// Rota protegida continua pedindo login, não entrega a tela
await page.goto(`${BASE}/financeiro`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
record(
  'Rota direta do financeiro também passa pelo login',
  await page.getByRole('heading', { name: 'Entrar' }).isVisible(),
);

// Validação local do formulário
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForTimeout(400);
record(
  'Formulário valida campos vazios',
  (await page.getByRole('alert').innerText()).includes('Informe e-mail e senha'),
);

// Tentativa real contra um servidor inexistente: mensagem amigável, sem quebrar
await page.getByLabel('E-mail').fill('teste@empresa.com.br');
await page.getByLabel('Senha').fill('senha-de-teste');
await page.getByRole('button', { name: 'Entrar' }).click();
await page.waitForTimeout(6000);
const alertText = await page.getByRole('alert').innerText().catch(() => '');
record(
  'Falha de conexão vira mensagem clara em português',
  /servidor da empresa/i.test(alertText) &&
    (await page.getByRole('heading', { name: 'Entrar' }).isVisible()),
  alertText.replace(/\n/g, ' ').slice(0, 90),
);
await page.screenshot({ path: path.join(OUT, '33-login-erro.png') });

// Link de redefinição de senha
await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
await page.waitForTimeout(3000);
record(
  'Redefinição de senha responde sem travar',
  await page.getByRole('heading', { name: 'Entrar' }).isVisible(),
);

record(
  'Sem exceções não tratadas no console',
  errors.filter((error) => !/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED/i.test(error))
    .length === 0,
  errors.slice(0, 2).join(' | '),
);

// A chave publicável é a única credencial no pacote; nada de service_role
const bundle = await page.evaluate(async () => {
  const scripts = Array.from(document.querySelectorAll('script[src]')).map((s) => s.src);
  const texts = await Promise.all(scripts.map((src) => fetch(src).then((r) => r.text())));
  return texts.join('\n');
});
// Procura por CHAVES de servidor, não pela palavra: o próprio código de
// proteção menciona "service_role" nas mensagens de alerta.
const secretKeys = bundle.match(/sb_secret_[A-Za-z0-9_-]{10,}/g) ?? [];
const serviceJwts = (bundle.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) ?? [])
  .filter((token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload?.role === 'service_role';
    } catch {
      return false;
    }
  });
record(
  'Pacote publicado não contém chave de servidor',
  secretKeys.length === 0 && serviceJwts.length === 0,
  `${secretKeys.length} chave(s) secreta(s), ${serviceJwts.length} JWT(s) de service_role`,
);
record(
  'Pacote carrega a chave publicável configurada no build',
  bundle.includes('chave-publicavel-de-teste-anon'),
);

await context.close();
await browser.close();
summary();
