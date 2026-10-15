import { describe, expect, it } from 'vitest';
import { buildInfoPlugin, montarBuildInfo } from '../../build/buildInfoPlugin';

/**
 * `build-info.json` é o que o empacotador usa para recusar um ZIP gerado em
 * modo local por engano. Ele precisa ler o MESMO `import.meta.env` que o Vite
 * embute no pacote: ler `process.env` faz o arquivo declarar "local" enquanto o
 * pacote sai em modo equipe — foi o que aconteceu de verdade aqui.
 */
describe('montarBuildInfo', () => {
  it('declara modo equipe quando as duas variáveis estão presentes', () => {
    const info = montarBuildInfo({
      VITE_SUPABASE_URL: 'https://exemplo.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_exemplo',
    });
    expect(info.mode).toBe('equipe');
    expect(info.supabaseHost).toBe('exemplo.supabase.co');
  });

  it('declara modo local quando não há variáveis', () => {
    const info = montarBuildInfo({});
    expect(info.mode).toBe('local');
    expect(info.supabaseHost).toBeNull();
  });

  it('não aceita apenas uma das duas variáveis como modo equipe', () => {
    expect(montarBuildInfo({ VITE_SUPABASE_URL: 'https://exemplo.supabase.co' }).mode).toBe('local');
    expect(montarBuildInfo({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }).mode).toBe('local');
  });

  it('ignora variáveis em branco', () => {
    expect(
      montarBuildInfo({ VITE_SUPABASE_URL: '   ', VITE_SUPABASE_PUBLISHABLE_KEY: '   ' }).mode,
    ).toBe('local');
  });

  it('registra só o modo, a data e o host — nunca a chave', () => {
    const info = montarBuildInfo({
      VITE_SUPABASE_URL: 'https://exemplo.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_segredo_nenhum',
    });
    expect(JSON.stringify(info)).not.toContain('sb_publishable_segredo_nenhum');
    expect(Object.keys(info).sort()).toEqual(['builtAt', 'mode', 'supabaseHost']);
  });
});

describe('plugin alinho-build-info', () => {
  /** Roda os ganchos como o Vite roda e devolve o JSON emitido. */
  function emitir(env: Record<string, string>) {
    const plugin = buildInfoPlugin();
    (plugin.configResolved as (c: unknown) => void).call(plugin, { env });

    let emitido: { fileName?: string; source?: string } | undefined;
    const contexto = {
      emitFile(file: { fileName?: string; source?: string }) {
        emitido = file;
      },
    };
    (plugin.generateBundle as (...args: unknown[]) => void).call(contexto);
    expect(emitido?.fileName).toBe('build-info.json');
    return JSON.parse(String(emitido?.source)) as { mode: string; supabaseHost: string | null };
  }

  it('usa o env resolvido pelo Vite, que é o que vai para dentro do pacote', () => {
    expect(emitir({
      VITE_SUPABASE_URL: 'https://exemplo.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_exemplo',
    })).toEqual({
      mode: 'equipe',
      supabaseHost: 'exemplo.supabase.co',
      builtAt: expect.any(String),
    });
  });

  it('não lê process.env, que não recebe os arquivos .env', () => {
    const anterior = process.env.VITE_SUPABASE_URL;
    const anteriorChave = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    process.env.VITE_SUPABASE_URL = 'https://nao-deveria-valer.supabase.co';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_nao_deveria_valer';
    try {
      expect(emitir({}).mode).toBe('local');
    } finally {
      if (anterior === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = anterior;
      if (anteriorChave === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = anteriorChave;
    }
  });

  it('só roda no build, nunca no servidor de desenvolvimento', () => {
    expect(buildInfoPlugin().apply).toBe('build');
  });
});
