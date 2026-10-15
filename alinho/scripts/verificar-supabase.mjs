/**
 * Confere, contra o SEU projeto Supabase, se as duas variáveis públicas estão
 * corretas e se o banco está protegido. Só faz leituras que DEVEM falhar — não
 * grava, não apaga e não precisa de senha de ninguém.
 *
 * Uso:
 *   node scripts/verificar-supabase.mjs            (lê o .env)
 *   VITE_SUPABASE_URL=... VITE_SUPABASE_PUBLISHABLE_KEY=... node scripts/verificar-supabase.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function lerEnv() {
  const arquivo = path.join(root, '.env');
  if (!fs.existsSync(arquivo)) return {};
  const vars = {};
  for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
    const match = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (match) vars[match[1]] = match[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return vars;
}

const env = { ...lerEnv(), ...process.env };
const url = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY (no .env ou no ambiente).');
  process.exit(1);
}

// Recusa chave de servidor antes de qualquer chamada.
function chaveDeServidor(valor) {
  if (valor.startsWith('sb_secret_')) return true;
  const partes = valor.split('.');
  if (partes.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64').toString()).role === 'service_role';
  } catch {
    return false;
  }
}

if (chaveDeServidor(key)) {
  console.error(
    'A chave informada é uma chave de SERVIDOR (service_role/secret). Ela ignora o RLS e não pode ' +
      'ir para o frontend. Use a chave publicável (anon) e revogue esta.',
  );
  process.exit(1);
}

const resultados = [];
const registrar = (caso, ok, detalhe = '') => {
  resultados.push({ caso, ok, detalhe });
  console.log(`${ok ? 'OK  ' : 'FALHA'} — ${caso}${detalhe ? ` :: ${detalhe}` : ''}`);
};

const cabecalhos = { apikey: key, Authorization: `Bearer ${key}` };

try {
  // 1. O endereço responde e a chave é aceita pelo serviço de autenticação.
  const settings = await fetch(`${url}/auth/v1/settings`, { headers: cabecalhos });
  const auth = settings.ok ? await settings.json() : null;
  registrar('Projeto acessível e chave publicável aceita', settings.ok, `HTTP ${settings.status}`);

  if (auth) {
    registrar(
      'Login por e-mail e senha habilitado',
      auth.external?.email !== false,
      `external.email = ${auth.external?.email}`,
    );
    registrar(
      'Cadastro público desabilitado (só você cria acessos)',
      auth.disable_signup === true,
      `disable_signup = ${auth.disable_signup}`,
    );
  }

  // 2. Sem login, o banco não entrega nada — é o RLS trabalhando.
  for (const tabela of ['leads', 'profiles', 'contracts', 'admin_bootstrap_allowlist']) {
    const resposta = await fetch(`${url}/rest/v1/${tabela}?select=*&limit=1`, { headers: cabecalhos });
    const corpo = await resposta.text();
    const vazio = corpo.trim() === '[]';
    registrar(
      `Anônimo não lê ${tabela}`,
      resposta.status === 401 || resposta.status === 403 || vazio,
      `HTTP ${resposta.status}${vazio ? ' (lista vazia)' : ''}`,
    );
  }

  // 3. E também não escreve.
  const escrita = await fetch(`${url}/rest/v1/leads`, {
    method: 'POST',
    headers: { ...cabecalhos, 'Content-Type': 'application/json' },
    body: JSON.stringify({ establishment_name: 'teste-de-verificacao-anonima' }),
  });
  registrar(
    'Anônimo não grava em leads',
    escrita.status === 401 || escrita.status === 403,
    `HTTP ${escrita.status}`,
  );
} catch (erro) {
  registrar('Conexão com o Supabase', false, String(erro));
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);
if (falhas.length > 0) {
  console.log('Pendências:');
  for (const f of falhas) console.log(` - ${f.caso} (${f.detalhe})`);
  process.exit(1);
}
