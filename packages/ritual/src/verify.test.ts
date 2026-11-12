import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Finding, PlacardReport } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { markRotated, verify } from './index';
import { fakeFinding, makeOptions } from './test-support';

/** Rapport minimal mais conforme au schéma, pour la relecture de vérification. */
function reportWith(findings: Finding[]): PlacardReport {
  return {
    schema: '1.0.0',
    tool: { name: 'placard', version: '0.1.0' },
    repo: {
      name: 'fixture',
      head: 'a'.repeat(40),
      totalCommits: 2,
      publicRemote: false,
      analyzedAt: '2026-11-11T00:00:00.000Z',
    },
    findings,
    skipped: { binary: 0, tooLarge: 0 },
  };
}

async function writeReport(dir: string, findings: Finding[]): Promise<string> {
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'report.json');
  await writeFile(path, JSON.stringify(reportWith(findings)), 'utf8');
  return path;
}

describe('verify', () => {
  it('seals the finding when the new analysis no longer finds it', async () => {
    const options = await makeOptions();
    const finding = fakeFinding();
    await markRotated(options, finding, { done: true, by: 'baptiste' });
    const reportPath = await writeReport(options.tmpDir, []);
    const state = await verify(options, finding, reportPath);
    expect(state.verify?.stillFound).toBe(false);
    expect(state.sealedAt).toBe(state.verify?.verifiedAt);
    expect(state.rotate).toBeDefined();
  });

  it('leaves the finding open and explains when the value is still found', async () => {
    const options = await makeOptions();
    const finding = fakeFinding();
    const reportPath = await writeReport(options.tmpDir, [finding]);
    const state = await verify(options, finding, reportPath);
    expect(state.verify?.stillFound).toBe(true);
    expect(state.sealedAt).toBeUndefined();
  });

  it('unseals a previously sealed finding that reappears', async () => {
    const options = await makeOptions();
    const finding = fakeFinding();
    const clean = await writeReport(join(options.tmpDir, 'a'), []);
    const first = await verify(options, finding, clean);
    expect(first.sealedAt).toBeDefined();
    const dirty = await writeReport(join(options.tmpDir, 'b'), [finding]);
    const second = await verify(options, finding, dirty);
    expect(second.sealedAt).toBeUndefined();
  });

  it('persists the verification in the ritual state', async () => {
    const options = await makeOptions();
    const finding = fakeFinding();
    const reportPath = await writeReport(options.tmpDir, []);
    const state = await verify(options, finding, reportPath);
    const { loadState } = await import('./state');
    expect(await loadState(options.placardDir, finding.fingerprint)).toEqual(state);
  });

  it('refuses a report that does not exist', async () => {
    const options = await makeOptions();
    await expect(verify(options, fakeFinding(), join(options.tmpDir, 'nope.json'))).rejects.toThrow(
      /Cannot read the analysis report/,
    );
  });

  it('refuses a report that does not match the schema', async () => {
    const options = await makeOptions();
    await mkdir(options.tmpDir, { recursive: true });
    const path = join(options.tmpDir, 'broken.json');
    await writeFile(path, JSON.stringify({ hello: 'world' }), 'utf8');
    await expect(verify(options, fakeFinding(), path)).rejects.toThrow(/does not match/);
  });
});
