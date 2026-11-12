import { rm } from 'node:fs/promises';

import { fakeValue } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { detectRewriteTool, dryRun } from './dry-run';
import { generatePurge, markRotated } from './index';
import { findingFor, gitOrThrow, makeOptions, makeRepoWithSecret } from './test-support';

/** Valeur fabriquée à l'exécution : rien au format réel n'est écrit ici. */
const VALUE = fakeValue('cloud-key', 'pla-p-09-seed');

describe('dryRun', () => {
  it('rewrites a throwaway mirror and reports how many commits changed', async (ctx) => {
    if ((await detectRewriteTool()) === 'none') {
      ctx.skip();
      return;
    }
    const repo = await makeRepoWithSecret(VALUE);
    const options = await makeOptions(repo.repoDir);
    const finding = findingFor(repo.value, { commit: repo.head, path: 'config.js', line: 2 });
    await markRotated(options, finding, { done: true, by: 'baptiste' });
    const artifacts = await generatePurge(options, [finding]);
    const result = await dryRun(options.repoDir, artifacts.scriptPath, { keepMirror: true });
    expect(result.commitsBefore).toBe(2);
    expect(result.commitsAfter).toBeGreaterThanOrEqual(1);
    expect(result.rewritten).toBeGreaterThan(0);
    expect(['git-filter-repo', 'git-filter-branch']).toContain(result.method);
    // Le dépôt analysé n'a pas bougé.
    const head = (await gitOrThrow(['rev-parse', 'HEAD'], options.repoDir)).trim();
    expect(head).toBe(repo.head);
    if (result.mirrorDir !== '') await rm(result.mirrorDir, { recursive: true, force: true });
  });
});

describe('PLA-P-09 — the purge removes the value from the whole history', () => {
  it('leaves no trace of the value in git log --all -p', async (ctx) => {
    if ((await detectRewriteTool()) === 'none') {
      // Ni git-filter-repo ni python3 : on le dit, on ne fait pas semblant.
      ctx.skip();
      return;
    }
    const repo = await makeRepoWithSecret(VALUE);
    const options = await makeOptions(repo.repoDir);
    const finding = findingFor(repo.value, { commit: repo.head, path: 'config.js', line: 2 });
    await markRotated(options, finding, { done: true, by: 'baptiste' });
    const artifacts = await generatePurge(options, [finding]);
    const result = await dryRun(options.repoDir, artifacts.scriptPath, { keepMirror: true });
    try {
      const history = await gitOrThrow(['log', '--all', '-p'], result.mirrorDir);
      expect(history).not.toContain(VALUE);
      expect(history).toContain('***REMOVED***');
      const refs = await gitOrThrow(['for-each-ref', '--format=%(refname)'], result.mirrorDir);
      expect(refs).not.toContain('refs/original');
    } finally {
      if (result.mirrorDir !== '') await rm(result.mirrorDir, { recursive: true, force: true });
    }
  });

  it('keeps the value readable in the original repository until the user pushes', async () => {
    const repo = await makeRepoWithSecret(VALUE);
    const history = await gitOrThrow(['log', '--all', '-p'], repo.repoDir);
    expect(history).toContain(VALUE);
  });
});
