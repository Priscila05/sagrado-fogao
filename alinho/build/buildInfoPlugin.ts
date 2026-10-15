import type { Plugin } from 'vite';

export interface BuildInfo {
  mode: 'local' | 'equipe';
  builtAt: string;
  supabaseHost: string | null;
}

/**
 * Decide o que vai em `build-info.json` a partir do `import.meta.env` resolvido
 * pelo Vite — e não de `process.env`, que não recebe os arquivos .env e faria o
 * arquivo declarar "local" enquanto o pacote sai em modo equipe.
 *
 * Nunca registra a chave: só o modo, a data e o host, para conferir o projeto.
 */
export function montarBuildInfo(env: Record<string, string | undefined>): BuildInfo {
  const url = (env.VITE_SUPABASE_URL ?? '').trim();
  const key = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
  return {
    mode: url && key ? 'equipe' : 'local',
    builtAt: new Date().toISOString(),
    supabaseHost: url ? new URL(url).host : null,
  };
}

/**
 * Grava `build-info.json` no pacote dizendo em qual modo ele foi compilado.
 * É o que permite ao empacotador recusar um ZIP gerado em modo local por engano.
 */
export function buildInfoPlugin(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: 'alinho-build-info',
    apply: 'build',
    configResolved(config) {
      env = config.env as Record<string, string>;
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify(montarBuildInfo(env), null, 2),
      });
    },
  };
}
