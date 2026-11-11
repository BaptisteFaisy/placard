import { describe, expect, it } from 'vitest';

import { dateFor, makeDetection, presenceMap, shaFor } from './fixtures.js';
import { daysBetween, lastSightingPerPath, makePresence, resolveLifetime } from './lifetime.js';

describe('resolveLifetime — introduction, retraits, présence dans HEAD (PLA-F-05)', () => {
  it('date l’introduction au premier commit qui porte la valeur', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 2 }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 0 }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 1 }),
    ];
    const lifetime = resolveLifetime(detections, makePresence(new Map()));
    expect(lifetime.introduced.commit).toBe(shaFor(0));
    expect(lifetime.inHead).toBe(false);
  });

  it('ne signale aucun retrait quand le secret est encore dans HEAD', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 0, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 1, path: 'src/a.ts' }),
    ];
    const lifetime = resolveLifetime(detections, makePresence(presenceMap('src/a.ts')));
    expect(lifetime.inHead).toBe(true);
    expect(lifetime.removed).toEqual([]);
  });

  it('signale le retrait quand la dernière observation n’est plus dans HEAD', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 0, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 1, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 2, path: 'src/b.ts' }),
    ];
    // `src/a.ts` a été purgé, `src/b.ts` porte encore la valeur.
    const lifetime = resolveLifetime(detections, makePresence(presenceMap('src/b.ts')));
    expect(lifetime.inHead).toBe(true);
    expect(lifetime.removed.map((commit) => commit.commit)).toEqual([shaFor(1)]);
  });

  it('rapporte un retrait par fichier purgé, trié par ordre de parcours', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 0, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 1, path: 'src/b.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 3, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 4, path: 'src/b.ts' }),
    ];
    const lifetime = resolveLifetime(detections, makePresence(new Map()));
    expect(lifetime.removed.map((commit) => commit.commit)).toEqual([shaFor(3), shaFor(4)]);
  });

  it('ne rapporte pas de retrait quand une seule observation existe', () => {
    const detections = [makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 4 })];
    expect(resolveLifetime(detections, makePresence(new Map())).removed).toEqual([]);
  });

  it('mesure la durée de vie jusqu’au retrait, ou jusqu’à la dernière observation', () => {
    const removed = resolveLifetime(
      [
        makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 0, path: 'src/a.ts' }),
        makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 5, path: 'src/a.ts' }),
      ],
      makePresence(new Map()),
    );
    expect(removed.lifetimeDays).toBe(5);

    const stillThere = resolveLifetime(
      [
        makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 0, path: 'src/a.ts' }),
        makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 3, path: 'src/a.ts' }),
      ],
      makePresence(presenceMap('src/a.ts')),
    );
    expect(stillThere.lifetimeDays).toBe(3);
  });

  it('refuse une liste vide', () => {
    expect(() => resolveLifetime([], makePresence(new Map()))).toThrow(/at least one detection/);
  });
});

describe('makePresence', () => {
  it('accepte une clé de type chemin ou de type SHA de commit', () => {
    const byPath = makePresence(presenceMap('src/a.ts'));
    const bySha = makePresence(presenceMap(shaFor(0)));
    const detection = makeDetection({
      family: 'cloud-key',
      seed: 'p',
      commitIndex: 0,
      path: 'src/a.ts',
    });
    expect(byPath(detection)).toBe(true);
    expect(bySha(detection)).toBe(true);
  });

  it('considère absent ce qui n’est pas dans la carte', () => {
    const detection = makeDetection({ family: 'cloud-key', seed: 'p' });
    expect(makePresence(new Map())(detection)).toBe(false);
  });
});

describe('lastSightingPerPath', () => {
  it('retient la dernière détection de chaque fichier', () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'q', commitIndex: 0, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'q', commitIndex: 2, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'q', commitIndex: 1, path: 'src/b.ts' }),
    ];
    const last = lastSightingPerPath(detections);
    expect(last.get('src/a.ts')?.commit.index).toBe(2);
    expect(last.get('src/b.ts')?.commit.index).toBe(1);
  });
});

describe('daysBetween', () => {
  it('compte des jours entiers', () => {
    expect(daysBetween(dateFor(0), dateFor(7))).toBe(7);
  });

  it('ne descend jamais sous zéro', () => {
    expect(daysBetween(dateFor(7), dateFor(0))).toBe(0);
  });

  it('retourne 0 sur une date invalide', () => {
    expect(daysBetween('pas-une-date', dateFor(1))).toBe(0);
  });
});
