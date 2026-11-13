import { mkdir, readdir, writeFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import type { RitualState } from '@placard/core';

import { loadState, saveState, stateDir, stateFileName, statePath } from './state';
import { makeOptions } from './test-support';

const FINGERPRINT = 'hmac256:0123456789abcdef0123456789abcdef';

function sample(): RitualState {
  return {
    fingerprint: FINGERPRINT,
    findingId: 'sk_0042',
    rotate: { doneAt: '2026-11-11T10:00:00.000Z', by: 'baptiste' },
    purge: { scriptPath: '/tmp/purge.sh', generatedAt: '2026-11-11T10:01:00.000Z' },
    prevent: { appliedAt: '2026-11-11T10:02:00.000Z', items: ['.gitignore', 'pre-commit'] },
    verify: {
      verifiedAt: '2026-11-11T10:03:00.000Z',
      reportPath: '/tmp/report.json',
      stillFound: false,
    },
    sealedAt: '2026-11-11T10:03:00.000Z',
  };
}

describe('state', () => {
  it('derives a filesystem-safe file name from the fingerprint', () => {
    expect(stateFileName(FINGERPRINT)).toBe('hmac256-0123456789abcdef0123456789abcdef.json');
    expect(stateFileName('hmac256:a/b')).toBe('hmac256-a-b.json');
    expect(stateFileName('')).toBe('unknown.json');
  });

  it('stores the state under <placardDir>/state', async () => {
    const options = await makeOptions();
    expect(statePath(options.placardDir, FINGERPRINT)).toBe(
      `${options.placardDir}/state/hmac256-0123456789abcdef0123456789abcdef.json`,
    );
  });

  it('reads back exactly what was written', async () => {
    const options = await makeOptions();
    const state = sample();
    await saveState(options.placardDir, state);
    expect(await loadState(options.placardDir, FINGERPRINT)).toEqual(state);
  });

  it('returns undefined for an unknown fingerprint', async () => {
    const options = await makeOptions();
    expect(await loadState(options.placardDir, 'hmac256:deadbeef')).toBeUndefined();
  });

  it('returns undefined for a corrupted state file instead of crashing', async () => {
    const options = await makeOptions();
    await mkdir(stateDir(options.placardDir), { recursive: true });
    await writeFile(statePath(options.placardDir, FINGERPRINT), '{not json', 'utf8');
    expect(await loadState(options.placardDir, FINGERPRINT)).toBeUndefined();
  });

  it('writes atomically, leaving no temporary file behind', async () => {
    const options = await makeOptions();
    await saveState(options.placardDir, sample());
    await saveState(options.placardDir, sample());
    const entries = await readdir(`${options.placardDir}/state`);
    expect(entries).toEqual([stateFileName(FINGERPRINT)]);
  });

  it('overwrites the previous state on a second save', async () => {
    const options = await makeOptions();
    await saveState(options.placardDir, sample());
    const updated: RitualState = { ...sample(), sealedAt: '2026-11-12T00:00:00.000Z' };
    await saveState(options.placardDir, updated);
    expect((await loadState(options.placardDir, FINGERPRINT))?.sealedAt).toBe(
      '2026-11-12T00:00:00.000Z',
    );
  });
});
