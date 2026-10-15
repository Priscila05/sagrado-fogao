import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * Grava `build-info.json` no pacote dizendo em qual modo ele foi compilado.
 * Não contém credencial alguma — só o modo e a data — e é o que permite ao
 * empacotador recusar um ZIP gerado em modo local por engano.
 */
function buildInfoPlugin(): Plugin {
  return {
    name: 'alinho-build-info',
    apply: 'build',
    generateBundle() {
      const url = (process.env.VITE_SUPABASE_URL ?? '').trim();
      const key = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
      const mode = url && key ? 'equipe' : 'local';
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify(
          {
            mode,
            builtAt: new Date().toISOString(),
            // apenas o host, para você conferir que é o projeto certo
            supabaseHost: url ? new URL(url).host : null,
          },
          null,
          2,
        ),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), buildInfoPlugin()],
  // Absolute base: deep links such as /leads/:id load assets correctly
  // once Netlify serves index.html for every path (see public/_redirects).
  base: '/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
