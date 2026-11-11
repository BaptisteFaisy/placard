import { rm } from 'node:fs/promises';

import { afterAll, describe, expect, it } from 'vitest';

import { allShas, FIXED_HEAD_DATE, makeRepo, repoGit } from './testing.js';

/**
 * Déterminisme : même graine + même `headDate` ⇒ mêmes SHA de commits.
 *
 * C'est la condition qui fait du générateur un oracle utilisable par les tests
 * par propriétés et par la démonstration reproductible.
 */

describe('déterminisme', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });

  it('produit exactement les mêmes commits pour deux générations identiques', async () => {
    const first = await makeRepo({ commits: 24, years: 1, headDate: FIXED_HEAD_DATE });
    const second = await makeRepo({ commits: 24, years: 1, headDate: FIXED_HEAD_DATE });
    dirs.push(first.repoDir, second.repoDir);

    expect(second.head).toBe(first.head);
    expect(await allShas(second.repoDir)).toEqual(await allShas(first.repoDir));
    expect(second.planted.map((secret) => secret.introducedCommit)).toEqual(
      first.planted.map((secret) => secret.introducedCommit),
    );
    expect(second.planted.map((secret) => secret.removedCommit)).toEqual(
      first.planted.map((secret) => secret.removedCommit),
    );
    expect(second.planted.map((secret) => secret.value)).toEqual(
      first.planted.map((secret) => secret.value),
    );
  }, 180_000);

  it('produit un dépôt différent pour une autre graine', async () => {
    const alpha = await makeRepo({ seed: 'alpha', commits: 12, years: 1 });
    const beta = await makeRepo({ seed: 'beta', commits: 12, years: 1 });
    dirs.push(alpha.repoDir, beta.repoDir);

    expect(beta.head).not.toBe(alpha.head);
    expect(beta.planted[0]?.value).not.toBe(alpha.planted[0]?.value);
  }, 180_000);

  it('produit un historique différent pour une autre date de tête', async () => {
    const early = await makeRepo({ commits: 12, years: 1, headDate: new Date('2024-01-01T00:00:00Z') });
    const late = await makeRepo({ commits: 12, years: 1, headDate: new Date('2026-01-01T00:00:00Z') });
    dirs.push(early.repoDir, late.repoDir);

    expect(late.head).not.toBe(early.head);
    expect(late.planted[0]?.date).not.toBe(early.planted[0]?.date);
  }, 180_000);

  it('respecte la date de tête demandée', async () => {
    const result = await makeRepo({ commits: 12, years: 1, headDate: FIXED_HEAD_DATE });
    dirs.push(result.repoDir);
    const raw = await repoGit(result.repoDir, ['log', '-1', '--format=%ct']);
    expect(Number(raw.trim())).toBe(Math.floor(FIXED_HEAD_DATE.getTime() / 1000));
  }, 180_000);
});
