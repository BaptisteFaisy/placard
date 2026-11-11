import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { fakeValue } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { GITIGNORE_LINES, PRE_COMMIT_HOOK, prevention } from './prevention.js';
import { makeOptions, makeRepoWithSecret } from './test-support.js';

async function optionsForRepo(): Promise<Awaited<ReturnType<typeof makeOptions>>> {
  const repo = await makeRepoWithSecret(fakeValue('cloud-key', 'prevention-seed'));
  return makeOptions(repo.repoDir);
}

describe('prevention', () => {
  it('proposes .gitignore lines and a pre-commit hook', async () => {
    const options = await optionsForRepo();
    const proposal = await prevention(options);
    expect(proposal.gitignoreLines).toEqual([...GITIGNORE_LINES]);
    expect(proposal.preCommitHook).toBe(PRE_COMMIT_HOOK);
    expect(proposal.preCommitHook).toContain('placard scan --staged');
  });

  it('points the hook at the repository git hooks directory', async () => {
    const options = await optionsForRepo();
    const proposal = await prevention(options);
    expect(proposal.hookPath.endsWith('/.git/hooks/pre-commit')).toBe(true);
    expect(proposal.hookPath.startsWith(options.repoDir)).toBe(true);
  });

  it('reminds the user about the host push protection and CI', async () => {
    const options = await optionsForRepo();
    const proposal = await prevention(options);
    const text = proposal.reminders.join('\n');
    expect(text).toMatch(/push protection/i);
    expect(text).toMatch(/secret scanning/i);
    expect(text).toMatch(/CI/);
  });

  it('writes nothing without apply', async () => {
    const options = await optionsForRepo();
    const proposal = await prevention(options);
    await expect(stat(proposal.hookPath)).rejects.toThrow();
    await expect(stat(join(options.repoDir, '.gitignore'))).rejects.toThrow();
  });

  it('applies the proposal only on demand', async () => {
    const options = await optionsForRepo();
    const proposal = await prevention(options, true);
    const hook = await readFile(proposal.hookPath, 'utf8');
    const ignore = await readFile(join(options.repoDir, '.gitignore'), 'utf8');
    expect(hook).toContain('placard scan --staged');
    expect((await stat(proposal.hookPath)).mode & 0o100).toBe(0o100);
    expect(ignore).toContain('.env');
    expect(ignore).toContain('.placard/state/');
  });

  it('does not duplicate .gitignore lines already present', async () => {
    const options = await optionsForRepo();
    await prevention(options, true);
    await prevention(options, true);
    const ignore = await readFile(join(options.repoDir, '.gitignore'), 'utf8');
    expect(ignore.split('\n').filter((line) => line === '.env')).toHaveLength(1);
  });

  it('never overwrites an existing hook: it writes a .placard proposal instead', async () => {
    const options = await optionsForRepo();
    const existing = await prevention(options);
    await (await import('node:fs/promises')).writeFile(existing.hookPath, '#!/bin/sh\nexit 0\n');
    const applied = await prevention(options, true);
    expect(await readFile(existing.hookPath, 'utf8')).toContain('exit 0');
    expect(await readFile(`${existing.hookPath}.placard`, 'utf8')).toContain('placard scan --staged');
    expect(applied.reminders[0]).toMatch(/already exists/);
  });
});
