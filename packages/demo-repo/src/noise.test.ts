import { rm } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GenerateResult } from './index.js';
import { allShas, makeRepo, repoGit } from './testing.js';

/**
 * PLA-P-12 — le bruit du dépôt synthétique ne contient aucun secret.
 *
 * Les dizaines de commits « ordinaires » doivent toucher uniquement des
 * fichiers sans valeur plantée : c'est ce qui permet de vérifier que le moteur
 * d'analyse ne remonte pas de faux positifs sur un historique réaliste.
 */

const NOISE_PATHS = new Set([
  'src/api.ts',
  'CHANGELOG.md',
  'assets/logo.png',
  'data/fixtures-large.log',
]);

const LARGE_ASSET = 'data/fixtures-large.log';

function isNoisePath(path: string): boolean {
  return NOISE_PATHS.has(path) || path.startsWith('src/modules/');
}

function distinctiveLines(value: string): string[] {
  return value.split('\n').filter((line) => line.trim().length > 12);
}

describe('bruit', () => {
  let result: GenerateResult;
  let dir: string;
  let noiseShas: string[];

  beforeAll(async () => {
    // Un dépôt un peu plus long qu'ailleurs : c'est ici que l'on vérifie que
    // le bruit est bien « des dizaines de commits ».
    result = await makeRepo({ commits: 60, years: 2 });
    dir = result.repoDir;
    const secretShas = new Set<string>();
    for (const secret of result.planted) {
      if (secret.introducedCommit !== undefined) secretShas.add(secret.introducedCommit);
      if (secret.removedCommit !== undefined) secretShas.add(secret.removedCommit);
    }
    const shas = await allShas(dir);
    noiseShas = shas.slice(1).filter((sha) => !secretShas.has(sha));
  }, 180_000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('compte des dizaines de commits sans aucun secret', () => {
    expect(noiseShas.length).toBeGreaterThan(30);
  });

  it('ne touche que des fichiers sans valeur plantée', async () => {
    for (const sha of noiseShas) {
      const touched = (
        await repoGit(dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
      )
        .split('\n')
        .filter((line) => line.length > 0);
      for (const path of touched) expect(isNoisePath(path)).toBe(true);
    }
  }, 180_000);

  it('n’introduit aucune valeur de l’oracle dans les diffs', async () => {
    const needles = result.planted.flatMap((secret) => distinctiveLines(secret.value));
    for (const sha of noiseShas) {
      const touched = (
        await repoGit(dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
      )
        .split('\n')
        .filter((line) => line.length > 0);
      if (touched.includes(LARGE_ASSET)) continue;
      const patch = await repoGit(dir, ['show', '--format=', sha]);
      for (const needle of needles) expect(patch).not.toContain(needle);
    }
  }, 180_000);

  it('produit un fichier volumineux fait de lignes banales', async () => {
    const content = await repoGit(dir, ['show', `HEAD:${LARGE_ASSET}`]);
    expect(content.split('\n').length).toBeGreaterThan(10_000);
    expect(content).not.toMatch(/[A-Za-z0-9]{32,}/);
  });
});
