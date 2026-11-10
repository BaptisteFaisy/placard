import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/** Un paquet de l'espace de travail, résolu sur ses sources (pas de build préalable). */
function source(paquet: string): string {
  return fileURLToPath(new URL(`./packages/${paquet}/src/index.ts`, import.meta.url));
}

const PAQUETS = [
  'core',
  'git-history',
  'detectors',
  'analysis',
  'demo-repo',
  'ritual',
  'cli',
  'ui',
  'web',
] as const;

const alias: Record<string, string> = {};
for (const paquet of PAQUETS) alias[`@placard/${paquet}`] = source(paquet);

export default defineConfig({
  resolve: { alias },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/src/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [
      ['packages/ui/**', 'jsdom'],
      ['packages/web/**', 'jsdom'],
    ],
    // Les lots git-history / demo-repo / analysis créent de vrais dépôts Git
    // temporaires : le budget par test est large, l'exécution se fait en
    // processus fils pour isoler les variables d'environnement Git.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: false } },
    reporters: ['default'],
  },
});
