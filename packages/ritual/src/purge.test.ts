import { readFile, stat } from 'node:fs/promises';

import { fakeValue } from '@placard/core';
import type { Finding, RitualOptions } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { generatePurge, isOutside, markRotated, PurgeLockedError } from './index';
import { findingFor, makeOptions, makeRepoWithSecret } from './test-support';

/** Valeur fabriquée à l'exécution (PLA-N-09), jamais écrite en dur. */
const VALUE = fakeValue('cloud-key', 'purge-seed');

interface Fixture {
  options: RitualOptions;
  finding: Finding;
}

async function fixture(rotate: 'none' | 'done' | 'notApplicable' = 'done'): Promise<Fixture> {
  const repo = await makeRepoWithSecret(VALUE);
  const options = await makeOptions(repo.repoDir);
  const finding = findingFor(repo.value, { commit: repo.head, path: 'config.js', line: 2 });
  if (rotate === 'done') await markRotated(options, finding, { done: true, by: 'baptiste' });
  if (rotate === 'notApplicable') {
    await markRotated(options, finding, {
      done: false,
      notApplicable: true,
      reason: 'sandbox credential, never valid',
    });
  }
  return { options, finding };
}

describe('generatePurge — ordre imposé', () => {
  it('refuses to purge before the rotation, with an explicit reason', async () => {
    const { options, finding } = await fixture('none');
    await expect(generatePurge(options, [finding])).rejects.toBeInstanceOf(PurgeLockedError);
    await expect(generatePurge(options, [finding])).rejects.toThrow(/Purge is locked/);
  });

  it('refuses a not-applicable rotation declared without a reason', async () => {
    const { options, finding } = await fixture('none');
    await expect(
      markRotated(options, finding, { done: false, notApplicable: true, reason: '   ' }),
    ).rejects.toThrow(/needs a reason/);
  });

  it('refuses a rotation attested without a name', async () => {
    const { options, finding } = await fixture('none');
    await expect(markRotated(options, finding, { done: true, by: ' ' })).rejects.toThrow(
      /attestation/,
    );
  });

  it('accepts the purge once the rotation is attested', async () => {
    const { options, finding } = await fixture('done');
    const artifacts = await generatePurge(options, [finding]);
    expect(artifacts.secure).toBe(true);
    expect(artifacts.scriptPath).toMatch(/purge-\d+\.sh$/);
    expect(artifacts.commands.length).toBeGreaterThanOrEqual(4);
  });
});

describe('generatePurge — fichier de remplacements', () => {
  it('is written outside the repository, with mode 0600', async () => {
    const { options, finding } = await fixture();
    const artifacts = await generatePurge(options, [finding]);
    const info = await stat(artifacts.replacementsPath);
    expect(info.mode & 0o777).toBe(0o600);
    expect(isOutside(artifacts.replacementsPath, options.repoDir)).toBe(true);
    expect(artifacts.replacementsPath.startsWith(options.tmpDir)).toBe(true);
  });

  it('is the only place where the value is written', async () => {
    const { options, finding } = await fixture();
    const artifacts = await generatePurge(options, [finding]);
    const replacements = await readFile(artifacts.replacementsPath, 'utf8');
    const script = await readFile(artifacts.scriptPath, 'utf8');
    expect(replacements).toContain(VALUE);
    expect(replacements).toContain('literal:');
    expect(script).not.toContain(VALUE);
  });

  it('is executable and contains no value', async () => {
    const { options, finding } = await fixture();
    const artifacts = await generatePurge(options, [finding]);
    const info = await stat(artifacts.scriptPath);
    expect(info.mode & 0o100).toBe(0o100);
    const script = await readFile(artifacts.scriptPath, 'utf8');
    expect(script).toContain('filter-repo');
    expect(script).toContain(artifacts.replacementsPath);
    expect(script).toContain('never runs this script');
  });

  it('keeps the artefacts out of the repository tree', async () => {
    const { options, finding } = await fixture();
    const artifacts = await generatePurge(options, [finding]);
    expect(artifacts.scriptPath.startsWith(`${options.repoDir}/.placard/scripts`)).toBe(true);
    expect(artifacts.replacementsPath.includes(options.repoDir)).toBe(false);
  });
});

describe('generatePurge — avertissements et commandes', () => {
  it('lists the commands to review, never executed by the tool', async () => {
    const { options, finding } = await fixture();
    const artifacts = await generatePurge(options, [finding]);
    const commands = artifacts.commands.join('\n');
    expect(commands).toContain('git clone --mirror');
    expect(commands).toContain('push --force');
    expect(commands).toContain('shred -u');
  });

  it('warns about changed commit ids, re-clones, forks and host caches', async () => {
    const { options, finding } = await fixture();
    const artifacts = await generatePurge(options, [finding]);
    const text = artifacts.warnings.join('\n');
    expect(text).toMatch(/new identifier/);
    expect(text).toMatch(/re-clone/);
    expect(text).toMatch(/forks/i);
    expect(text).toMatch(/cache/i);
  });

  it('accepts values injected by the engine instead of reading the repository', async () => {
    const options = await makeOptions();
    const injected = fakeValue('platform-token', 'injected-seed');
    const finding = findingFor(injected, { commit: 'b'.repeat(40), path: 'nowhere.js' });
    await markRotated(options, finding, { done: true, by: 'baptiste' });
    const artifacts = await generatePurge(
      options,
      [finding],
      new Map([[finding.fingerprint, injected]]),
    );
    expect(await readFile(artifacts.replacementsPath, 'utf8')).toContain(injected);
  });

  it('warns when a value cannot be recovered instead of inventing one', async () => {
    const options = await makeOptions();
    const finding = findingFor(fakeValue('cloud-key', 'missing-seed'), {
      commit: 'c'.repeat(40),
      path: 'missing.js',
    });
    await markRotated(options, finding, { done: true, by: 'baptiste' });
    const artifacts = await generatePurge(options, [finding]);
    expect(artifacts.warnings.join('\n')).toMatch(/No value could be recovered/);
    expect(await readFile(artifacts.replacementsPath, 'utf8')).not.toContain('literal:');
  });
});
