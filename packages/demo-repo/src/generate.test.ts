import { rm } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FAMILIES, type GenerateResult } from './index.js';
import { allShas, makeRepo, pathsAt, pathsContaining, repoGit, showAt } from './testing.js';

/**
 * PLA-F-13 — le générateur fabrique un dépôt crédible, complet et varié.
 * Toutes les assertions portent sur le dépôt réellement produit.
 */

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

describe('generate — forme du dépôt', () => {
  it('produit le nombre de commits demandé, sur la branche main', async () => {
    expect(shas).toHaveLength(result.commits);
    expect(result.commits).toBe(60);
    const branch = await repoGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    expect(branch.trim()).toBe('main');
    expect(shas[shas.length - 1]).toBe(result.head);
  });

  it('plante au moins une valeur de chaque famille', () => {
    const planted = new Set(result.planted.map((secret) => secret.family));
    for (const family of FAMILIES) expect(planted.has(family)).toBe(true);
    expect(result.planted.length).toBeGreaterThanOrEqual(FAMILIES.length);
  });

  it('embarque un fichier binaire et un fichier volumineux', async () => {
    const paths = await pathsAt(dir, 'HEAD');
    expect(paths).toContain('assets/logo.png');
    expect(paths).toContain('data/fixtures-large.log');
    const binarySize = Number(
      (await repoGit(dir, ['cat-file', '-s', 'HEAD:assets/logo.png'])).trim(),
    );
    const largeSize = Number(
      (await repoGit(dir, ['cat-file', '-s', 'HEAD:data/fixtures-large.log'])).trim(),
    );
    expect(binarySize).toBeLessThan(4096);
    expect(largeSize).toBeGreaterThan(1024 * 1024);
  });

  it('ressemble à un vrai dépôt : README, manifeste et sources', async () => {
    const paths = await pathsAt(dir, 'HEAD');
    expect(paths).toContain('README.md');
    expect(paths).toContain('package.json');
    expect(paths).toContain('src/config.ts');
    expect(paths.filter((path) => path.startsWith('src/')).length).toBeGreaterThan(5);
    const manifest = JSON.parse(`${await showAt(dir, 'HEAD', 'package.json')}`);
    expect(manifest.name).toBe('reports-service');
  });

  it('couvre plusieurs années d’historique', async () => {
    const stamps = (await repoGit(dir, ['log', '--format=%at']))
      .split('\n')
      .filter((line) => line.length > 0)
      .map(Number);
    const spanDays = (Math.max(...stamps) - Math.min(...stamps)) / 86_400;
    expect(spanDays).toBeGreaterThan(300);
  });

  it('ajoute un distant public quand on le demande', async () => {
    const publicRepo = await makeRepo({ commits: 8, years: 1, publicRemote: true });
    const remotes = await repoGit(publicRepo.repoDir, ['remote', '-v']);
    await rm(publicRepo.repoDir, { recursive: true, force: true });
    expect(remotes).toContain('origin');
    expect(remotes).toContain('github.com');
  }, 180_000);
});

describe('generate — arcs de vie des valeurs plantées', () => {
  it('respecte l’oracle : la valeur est dans le fichier au commit d’introduction', async () => {
    for (const secret of result.planted) {
      expect(secret.introducedCommit).toBeTruthy();
      const content = await showAt(dir, `${secret.introducedCommit}`, secret.path);
      if (secret.family === 'risky-file') {
        expect(content).toBeDefined();
      } else {
        expect(content).toContain(secret.value);
      }
    }
  });

  it('laisse au moins une valeur dans HEAD, et en a retiré d’autres', async () => {
    const kept = result.planted.filter((secret) => secret.inHead);
    const removed = result.planted.filter((secret) => !secret.inHead);
    expect(kept.length).toBeGreaterThan(0);
    expect(removed.length).toBeGreaterThan(0);
    for (const secret of removed) expect(secret.removedCommit).toBeTruthy();
    for (const secret of kept) {
      const content = await showAt(dir, 'HEAD', secret.path);
      if (secret.family === 'risky-file') expect(content).toBeDefined();
      else expect(content).toContain(secret.value);
    }
  });

  it('varie les arcs de vie : durée courte et durée longue', () => {
    const spans = result.planted
      .filter((secret) => secret.removedCommit !== undefined)
      .map((secret) => {
        const intro = shas.indexOf(`${secret.introducedCommit}`);
        const removal = shas.indexOf(`${secret.removedCommit}`);
        return removal - intro;
      });
    expect(spans.some((span) => span === 1)).toBe(true);
    expect(spans.some((span) => span > 5)).toBe(true);
  });

  it('plante une même valeur à plusieurs emplacements', async () => {
    const multi = result.planted.find(
      (secret) => secret.locations >= 3 && secret.family !== 'risky-file',
    );
    expect(multi).toBeDefined();
    const paths = await pathsContaining(dir, `${multi?.introducedCommit}`, `${multi?.value}`);
    expect(paths).toHaveLength(multi?.locations ?? 0);
    expect(paths).toContain(multi?.path);
  });

  it('signale les chemins de test ou d’exemple', () => {
    const inTest = result.planted.filter((secret) => secret.testPath);
    expect(inTest.length).toBeGreaterThan(0);
    expect(inTest.every((secret) => /(^|\/)(tests?|examples?|docs)\//.test(secret.path))).toBe(
      true,
    );
  });
});
