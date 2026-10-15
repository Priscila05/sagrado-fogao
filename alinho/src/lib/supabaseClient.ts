import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase.
 *
 * O aplicativo funciona em dois modos:
 *   - **local**: nenhuma variável configurada. É o ALINHO de sempre, com os
 *     dados no navegador e sem login. Nada muda para quem já usa.
 *   - **equipe**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`
 *     definidos no build. Exige login e usa o banco compartilhado.
 *
 * Só a chave publicável (anon/publishable) entra aqui. Chaves `service_role`
 * ou secretas nunca devem ir para o frontend: elas ignoram o RLS e ficariam
 * visíveis para qualquer visitante do site.
 */

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

/** Impede que uma chave de servidor seja publicada por engano. */
function looksLikeServerKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return true;
  // JWTs do Supabase trazem o papel no payload.
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

const serverKeyDetected = looksLikeServerKey(rawKey);
if (serverKeyDetected) {
  console.error(
    '[alinho] A chave informada em VITE_SUPABASE_PUBLISHABLE_KEY parece ser uma chave de ' +
      'servidor (service_role/secret). Ela NÃO será usada. Publique apenas a chave ' +
      'publicável (anon) — a outra dá acesso total ao banco e precisa ser revogada.',
  );
}

function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export const supabaseUrl = isValidUrl(rawUrl) ? rawUrl : '';
export const supabaseKey = serverKeyDetected ? '' : rawKey;

/** Verdadeiro quando o modo equipe está configurado neste build. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}

/** Motivo pelo qual o modo equipe não está ativo, para exibir na interface. */
export function supabaseConfigIssue(): string | null {
  if (isSupabaseConfigured()) return null;
  if (serverKeyDetected) {
    return 'A chave publicada parece ser uma chave de servidor (service_role). Troque pela chave publicável (anon) e revogue a anterior.';
  }
  if (rawUrl && !supabaseUrl) return 'VITE_SUPABASE_URL não é uma URL válida.';
  if (!rawUrl && !rawKey) return null;
  return 'Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY antes de gerar o build.';
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'alinho.auth',
      },
    });
  }
  return client;
}
