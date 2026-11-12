import { rm } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GenerateResult } from './index';
import { allShas, makeRepo, pathsAt, pathsContaining, repoGit, showAt } from './testing';

/**
 * L'oracle est la vérité terrain du projet : chaque affirmation qu'il porte doit
 * être confirmée par le dépôt Git réellement produit.
 */

/** Chemin où la valeur est présente, selon la famille (les fichiers à risque se plantent par leur nom). */
async function locationsAt(dir: string, rev: string, secret: GenerateResult['planted'][number]): Promise<string[]> {
  if (secret.family === 'risky-file') {
    const paths = await pathsAt(dir, rev);
    return paths.filter((path) => path.endsWith(secret.value));
  }
  return pathsContaining(dir, rev, secret.value);
}

describe('oracle', () => {
  let result: GenerateResult;
  let dir: string;
  let shas: string[];

  beforeAll(async () => {
    result = await makeRepo();
    dir = result.repoDir;
    shas = await allShas(dir);
  }, 180_000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('expose tous les champs du contrat pour chaque valeur plantée', () => {
    for (const secret of result.planted) {
      expect(secret.id.length).toBeGreaterThan(0);
      expect(secret.expectedRule.length).toBeGreaterThan(0);
      expect(secret.value.length).toBeGreaterThan(0);
      expect(secret.path.length).toBeGreaterThan(0);
      expect(secret.line).toBeGreaterThanOrEqual(1);
      expect(secret.locations).toBeGreaterThanOrEqual(1);
      expect(Number.isNaN(Date.parse(secret.date))).toBe(false);
      expect(typeof secret.inHead).toBe('boolean');
      expect(typeof secret.testPath).toBe('boolean');
    }
  });

  it('désigne des SHA réellement présents dans l’historique', () => {
    const known = new Set(shas);
    for (const secret of result.planted) {
      expect(known.has(`${secret.introducedCommit}`)).toBe(true);
      if (secret.removedCommit !== undefined) {
        expect(known.has(secret.removedCommit)).toBe(true);
        expect(secret.removedCommit).not.toBe(secret.introducedCommit);
      }
    }
  });

  it('donne le bon numéro de ligne au commit d’introduction', async () => {
    for (const secret of result.planted) {
      if (secret.family === 'risky-file') continue;
      const content = await showAt(dir, `${secret.introducedCommit}`, secret.path);
      expect(content).toBeDefined();
      const lines = `${content}`.split('\n');
      const anchor = secret.value.split('\n')[0] ?? '';
      expect(lines[secret.line - 1] ?? '').toContain(anchor.trim());
    }
  });

  it('vérifie que le commit d’introduction est le premier à porter la valeur', async () => {
    for (const secret of result.planted) {
      const parent = await showAt(dir, `${secret.introducedCommit}^`, secret.path);
      if (secret.family === 'risky-file') {
        expect(parent).toBeUndefined();
      } else {
        expect(parent === undefined || !parent.includes(secret.value)).toBe(true);
      }
    }
  });

  it('vérifie que le commit de retrait a fait disparaître la valeur', async () => {
    for (const secret of result.planted) {
      if (secret.removedCommit === undefined) continue;
      const after = await showAt(dir, secret.removedCommit, secret.path);
      if (secret.family === 'risky-file') {
        // La valeur est le **nom** du fichier : le chemin a disparu.
        expect(after).toBeUndefined();
        const parent = await showAt(dir, `${secret.removedCommit}^`, secret.path);
        expect(parent).toBeDefined();
        continue;
      }
      expect(after === undefined || !after.includes(secret.value)).toBe(true);
      const before = await showAt(dir, `${secret.removedCommit}^`, secret.path);
      expect(`${before}`).toContain(secret.value);
    }
  });

  it('compte les emplacements réels de chaque valeur', async () => {
    for (const secret of result.planted) {
      const found = await locationsAt(dir, `${secret.introducedCommit}`, secret);
      expect(found).toHaveLength(secret.locations);
      expect(found).toContain(secret.path);
    }
  });

  it('marque dans HEAD exactement les valeurs non retirées', async () => {
    for (const secret of result.planted) {
      const expected = secret.removedCommit === undefined;
      expect(secret.inHead).toBe(expected);
      const found = await locationsAt(dir, 'HEAD', secret);
      expect(found.length > 0).toBe(expected);
    }
  });

  it('horodate chaque valeur au commit qui l’a introduite', async () => {
    for (const secret of result.planted) {
      const epoch = Number(
        (await repoGit(dir, ['log', '-1', '--format=%ct', `${secret.introducedCommit}`])).trim(),
      );
      expect(Math.floor(Date.parse(secret.date) / 1000)).toBe(epoch);
    }
  });
});
