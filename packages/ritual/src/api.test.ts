import type { RitualApi } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { createRitualApi } from './index';

describe('createRitualApi', () => {
  it('implements every member of the RitualApi contract', () => {
    const api: RitualApi = createRitualApi();
    const members: (keyof RitualApi)[] = [
      'steps',
      'rotationCard',
      'markRotated',
      'generatePurge',
      'prevention',
      'verify',
      'certificate',
      'loadState',
      'saveState',
    ];
    for (const member of members) {
      expect(typeof api[member]).toBe('function');
    }
  });

  it('also exposes the optional dry run', () => {
    expect(typeof createRitualApi().dryRun).toBe('function');
  });
});
