import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

function source(paquet: string): string {
  return fileURLToPath(new URL(`../${paquet}/src/index.ts`, import.meta.url));
}

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@placard/core': fileURLToPath(new URL('../core/src/browser.ts', import.meta.url)),
      '@placard/manor-model': source('manor-model'),
      '@placard/ui': source('ui'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
