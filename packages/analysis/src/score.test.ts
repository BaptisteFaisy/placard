import { describe, expect, it } from 'vitest';

import { TEST_SALT, makeDetection } from './fixtures';
import { groupDetections } from './group';
import { isDummyGroup, isTestOnlyGroup, scoreGroup } from './score';

/** Groupe d'une seule détection, pour isoler un terme du score. */
function groupOf(
  spec: Parameters<typeof makeDetection>[0],
): ReturnType<typeof groupDetections>[number] {
  const group = groupDetections([makeDetection(spec)], TEST_SALT)[0];
  if (group === undefined) throw new Error('group fixture missing');
  return group;
}

describe('scoreGroup — barème du cahier C.6 (PLA-F-07)', () => {
  it('part de la base de la famille', () => {
    const result = scoreGroup(groupOf({ family: 'cloud-key', seed: 'score' }), {
      publicRemote: false,
      inHead: false,
    });
    expect(result.score).toBe(85);
    expect(result.reasons[0]).toBe('base cloud-key: +85');
  });

  it('ajoute 15 quand le secret est encore dans HEAD', () => {
    const result = scoreGroup(groupOf({ family: 'cloud-key', seed: 'score' }), {
      publicRemote: false,
      inHead: true,
    });
    expect(result.score).toBe(100);
    expect(result.reasons).toContain('still present in HEAD: +15');
  });

  it('ajoute 10 quand le dépôt a un distant public', () => {
    const result = scoreGroup(groupOf({ family: 'identity', seed: 'score' }), {
      publicRemote: true,
      inHead: false,
    });
    expect(result.score).toBe(40);
    expect(result.reasons).toContain('public remote repository: +10');
  });

  it('retire 30 sur un chemin de test ou d’exemple', () => {
    const result = scoreGroup(groupOf({ family: 'plaintext-password', seed: 'score', path: 'tests/env.ts' }), {
      publicRemote: false,
      inHead: false,
    });
    expect(result.score).toBe(30);
    expect(result.reasons).toContain('test/example directory path: -30');
  });

  it('retire 20 sur une valeur factice connue', () => {
    const result = scoreGroup(groupOf({ family: 'plaintext-password', value: 'changeme' }), {
      publicRemote: false,
      inHead: false,
    });
    expect(result.score).toBe(40);
    expect(result.reasons).toContain('known dummy/mock placeholder: -20');
  });

  it('cumule les termes et garde la liste explicative complète', () => {
    const result = scoreGroup(
      groupOf({ family: 'plaintext-password', value: 'changeme', path: 'examples/demo.ts' }),
      { publicRemote: true, inHead: true },
    );
    expect(result.score).toBe(35);
    expect(result.reasons).toHaveLength(5);
  });

  it('borne le score entre 0 et 100', () => {
    const result = scoreGroup(groupOf({ family: 'private-key', seed: 'score' }), {
      publicRemote: true,
      inHead: true,
    });
    expect(result.score).toBe(100);
  });
});

describe('isTestOnlyGroup — monotonicité du chemin (PLA-P-07)', () => {
  it('est vrai seulement si tous les emplacements sont des chemins de test', () => {
    const onlyTest = groupDetections(
      [makeDetection({ family: 'cloud-key', seed: 't', path: 'tests/a.ts' })],
      TEST_SALT,
    )[0];
    expect(isTestOnlyGroup(onlyTest!)).toBe(true);

    const mixed = groupDetections(
      [
        makeDetection({ family: 'cloud-key', seed: 't', path: 'tests/a.ts' }),
        makeDetection({ family: 'cloud-key', seed: 't', path: 'src/a.ts' }),
      ],
      TEST_SALT,
    )[0];
    expect(isTestOnlyGroup(mixed!)).toBe(false);
  });

  it('donne un score de test inférieur ou égal au score ordinaire', () => {
    const inTest = scoreGroup(groupOf({ family: 'cloud-key', seed: 'm', path: 'fixtures/k.ts' }), {
      publicRemote: false,
      inHead: false,
    });
    const inSource = scoreGroup(groupOf({ family: 'cloud-key', seed: 'm', path: 'src/k.ts' }), {
      publicRemote: false,
      inHead: false,
    });
    expect(inTest.score).toBeLessThanOrEqual(inSource.score);
  });
});

describe('isDummyGroup', () => {
  it('reconnaît une valeur factice par motif, jamais par comparaison', () => {
    expect(isDummyGroup(groupOf({ family: 'plaintext-password', value: 'your_key_here' }))).toBe(true);
    expect(isDummyGroup(groupOf({ family: 'plaintext-password', seed: 'real' }))).toBe(false);
  });
});
