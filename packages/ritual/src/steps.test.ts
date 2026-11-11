import { describe, expect, it } from 'vitest';

import type { RitualState } from '@placard/core';

import { PURGE_LOCK_REASON, isRotationDone, steps } from './steps.js';
import { fakeFinding, findingFor } from './test-support.js';

const NOW = '2026-11-11T10:00:00.000Z';

function rotated(): RitualState {
  return { fingerprint: 'hmac256:x', findingId: 'sk_0001', rotate: { doneAt: NOW, by: 'baptiste' } };
}

describe('steps', () => {
  it('returns the four steps in the imposed order', () => {
    const result = steps(fakeFinding(), undefined);
    expect(result.map((step) => step.id)).toEqual(['rotate', 'purge', 'prevent', 'verify']);
  });

  it('locks the purge while the rotation is not attested', () => {
    const purge = steps(fakeFinding(), undefined)[1];
    expect(purge?.locked).toBe(true);
    expect(purge?.lockReason).toBe(PURGE_LOCK_REASON);
    expect(purge?.lockReason).toMatch(/rotate the credential first/i);
  });

  it('unlocks the purge once the rotation is done', () => {
    const purge = steps(fakeFinding(), rotated())[1];
    expect(purge?.locked).toBe(false);
    expect(purge?.lockReason).toBeUndefined();
  });

  it('unlocks the purge when the rotation is declared not applicable', () => {
    const state: RitualState = {
      fingerprint: 'hmac256:x',
      findingId: 'sk_0001',
      rotate: { notApplicable: true, reason: 'not a credential', date: NOW },
    };
    expect(steps(fakeFinding(), state)[1]?.locked).toBe(false);
    expect(isRotationDone(state)).toBe(true);
  });

  it('keeps the prevention and verify steps unlocked at all times', () => {
    const result = steps(fakeFinding(), undefined);
    expect(result[2]?.locked).toBe(false);
    expect(result[3]?.locked).toBe(false);
  });

  it('renames step 1 to an evaluation for personal data', () => {
    const finding = findingFor('jean.dupont@example-family.fr', { family: 'identity' });
    const rotate = steps(finding, undefined)[0];
    expect(rotate?.title).toBe('Evaluate the exposure');
    expect(rotate?.description).toMatch(/personal data/i);
  });

  it('reflects the recorded progress in done and doneAt', () => {
    const state: RitualState = {
      fingerprint: 'hmac256:x',
      findingId: 'sk_0001',
      rotate: { doneAt: NOW, by: 'baptiste' },
      purge: { scriptPath: '/tmp/purge.sh', generatedAt: NOW },
      prevent: { appliedAt: NOW, items: ['.gitignore'] },
      verify: { verifiedAt: NOW, reportPath: '/tmp/r.json', stillFound: false },
      sealedAt: NOW,
    };
    const result = steps(fakeFinding(), state);
    expect(result.every((step) => step.done)).toBe(true);
    expect(result[0]?.doneAt).toBe(NOW);
    expect(result[3]?.doneAt).toBe(NOW);
  });

  it('reports an unfinished ritual as not done', () => {
    const result = steps(fakeFinding(), rotated());
    expect(result[0]?.done).toBe(true);
    expect(result[1]?.done).toBe(false);
    expect(result[2]?.done).toBe(false);
    expect(result[3]?.done).toBe(false);
  });
});
