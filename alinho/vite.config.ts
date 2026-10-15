import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { buildInfoPlugin } from './build/buildInfoPlugin';

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
