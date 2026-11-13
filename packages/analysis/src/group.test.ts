import { computeFingerprint } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { TEST_SALT, makeDetection } from './fixtures';
import { fingerprintOf, groupDetections, locationsOf } from './group';

describe('groupDetections — regroupement par empreinte (PLA-F-06)', () => {
  it('regroupe la même valeur trouvée à plusieurs endroits en un seul groupe', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'g1', commitIndex: 0, path: 'src/a.ts', line: 3 }),
      makeDetection({ family: 'cloud-key', seed: 'g1', commitIndex: 1, path: 'src/b.ts', line: 8 }),
      makeDetection({ family: 'cloud-key', seed: 'g1', commitIndex: 2, path: 'src/c.ts', line: 1 }),
    ];
    const groups = groupDetections(detections, TEST_SALT);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.detections).toHaveLength(3);
    expect(locationsOf(groups[0]!)).toHaveLength(3);
  });

  it('sépare deux valeurs distinctes en deux groupes', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'g1' }),
      makeDetection({ family: 'cloud-key', seed: 'g2' }),
    ];
    expect(groupDetections(detections, TEST_SALT)).toHaveLength(2);
  });

  it('groupe sur l’empreinte, pas sur la famille : une même valeur reste unique', () => {
    const value = makeDetection({ family: 'cloud-key', seed: 'shared' }).detection.value;
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'shared', rule: 'rule-a', confidence: 0.4 }),
      makeDetection({ family: 'platform-token', seed: 'shared', value, rule: 'rule-b' }),
    ];
    const groups = groupDetections(detections, TEST_SALT);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.fingerprint).toBe(computeFingerprint(value, TEST_SALT));
  });

  it('trie les groupes par empreinte (ordre déterministe, PLA-P-05)', () => {
    const detections = [
      makeDetection({ family: 'identity', seed: 'x' }),
      makeDetection({ family: 'cloud-key', seed: 'x' }),
      makeDetection({ family: 'bank-data', seed: 'x' }),
    ];
    const fingerprints = groupDetections(detections, TEST_SALT).map((group) => group.fingerprint);
    expect(fingerprints).toEqual([...fingerprints].sort());
  });

  it('retient la règle la plus confiante pour représenter le groupe', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'r', rule: 'weak-rule', confidence: 0.2 }),
      makeDetection({ family: 'cloud-key', seed: 'r', rule: 'strong-rule', confidence: 0.95 }),
    ];
    const group = groupDetections(detections, TEST_SALT)[0];
    expect(group?.rule).toBe('strong-rule');
    expect(group?.confidence).toBe(0.95);
  });

  it('départage à confiance égale par l’identifiant de règle', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'r', rule: 'zebra', confidence: 0.5 }),
      makeDetection({ family: 'cloud-key', seed: 'r', rule: 'alpha', confidence: 0.5 }),
    ];
    expect(groupDetections(detections, TEST_SALT)[0]?.rule).toBe('alpha');
  });

  it('trie les détections d’un groupe par commit, puis chemin, puis ligne', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 's', commitIndex: 2, path: 'src/a.ts', line: 1 }),
      makeDetection({ family: 'cloud-key', seed: 's', commitIndex: 0, path: 'src/z.ts', line: 4 }),
      makeDetection({ family: 'cloud-key', seed: 's', commitIndex: 0, path: 'src/a.ts', line: 9 }),
    ];
    const order = groupDetections(detections, TEST_SALT)[0]?.detections.map(
      (detection) => `${detection.commit.index}:${detection.path}:${detection.lineNumber}`,
    );
    expect(order).toEqual(['0:src/a.ts:9', '0:src/z.ts:4', '2:src/a.ts:1']);
  });
});

describe('locationsOf', () => {
  it('déduplique un même emplacement vu deux fois', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'd', commitIndex: 1, path: 'src/a.ts', line: 5 }),
      makeDetection({
        family: 'cloud-key',
        seed: 'd',
        commitIndex: 1,
        path: 'src/a.ts',
        line: 5,
        rule: 'autre-regle',
      }),
    ];
    const group = groupDetections(detections, TEST_SALT)[0];
    expect(group?.detections).toHaveLength(2);
    expect(locationsOf(group!)).toHaveLength(1);
  });

  it('ajoute l’extrait fourni par le constructeur d’emplacements', () => {
    const group = groupDetections([makeDetection({ family: 'cloud-key', seed: 'e' })], TEST_SALT)[0];
    const [location] = locationsOf(group!, () => '[REDACTED:cloud-key]');
    expect(location?.snippet).toBe('[REDACTED:cloud-key]');
  });
});

describe('fingerprintOf', () => {
  it('dépend du sel du dépôt', () => {
    const detection = makeDetection({ family: 'cloud-key', seed: 'salt' });
    expect(fingerprintOf(detection, 'sel-a')).not.toBe(fingerprintOf(detection, 'sel-b'));
    expect(fingerprintOf(detection, 'sel-a')).toMatch(/^hmac256:[0-9a-f]{32}$/);
  });
});
