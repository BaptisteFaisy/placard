import {
  FAMILIES,
  computeDangerScore,
  fakeValue,
  isDummyValue,
  stringifyReport,
  type FindingFamily,
} from '@placard/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { TEST_SALT, makeDetection, makeInput, makeOptions, presenceMap } from './fixtures.js';
import { groupDetections } from './group.js';
import { analyze } from './index.js';
import { scoreGroup } from './score.js';

/**
 * Propriétés fast-check du lot analyse.
 *
 * Les valeurs sont **fabriquées à l'exécution** (`fakeValue` de core) : aucune
 * valeur au format réel d'un secret n'est écrite dans ce fichier (PLA-N-09).
 */

/** Arbitraire d'une famille de trouvaille. */
const familyArb = fc.constantFrom<FindingFamily>(...FAMILIES);

/** Arbitraire d'une graine courte et variée. */
const seedArb = fc.string({ minLength: 1, maxLength: 12 });

/** Score d'un groupe d'une seule détection, pour isoler les entrées du calcul. */
function singleGroupScore(
  family: FindingFamily,
  options: { path: string; inHead: boolean; publicRemote: boolean },
): number {
  const group = groupDetections(
    [makeDetection({ family, seed: 'prop', path: options.path })],
    TEST_SALT,
  )[0];
  if (group === undefined) throw new Error('groupe absent');
  return scoreGroup(group, { inHead: options.inHead, publicRemote: options.publicRemote }).score;
}

describe('PLA-P-06 — N emplacements, une trouvaille', () => {
  it('un même secret vu à N endroits donne N emplacements et un seul groupe', () => {
    fc.assert(
      fc.asyncProperty(familyArb, seedArb, fc.integer({ min: 1, max: 8 }), async (family, seed, count) => {
        const detections = Array.from({ length: count }, (_, index) =>
          makeDetection({
            family,
            seed,
            commitIndex: index,
            path: `src/file-${index}.ts`,
            line: index + 1,
          }),
        );
        const result = await analyze(makeInput(detections), makeOptions());
        expect(result.groups).toBe(1);
        expect(result.report.findings).toHaveLength(1);
        expect(result.report.findings[0]?.locations).toHaveLength(count);
      }),
      { numRuns: 25 },
    );
  });
});

describe('PLA-P-07 — monotonicité du score', () => {
  it('présence dans HEAD ne fait jamais baisser le score', () => {
    fc.assert(
      fc.property(familyArb, seedArb, (family, seed) => {
        const detection = makeDetection({ family, seed, path: 'src/app.ts' });
        const group = groupDetections([detection], TEST_SALT)[0];
        if (group === undefined) throw new Error('groupe absent');
        const present = scoreGroup(group, { inHead: true, publicRemote: false }).score;
        const absent = scoreGroup(group, { inHead: false, publicRemote: false }).score;
        expect(present).toBeGreaterThanOrEqual(absent);
      }),
      { numRuns: 50 },
    );
  });

  it('un chemin de test ne fait jamais monter le score', () => {
    fc.assert(
      fc.property(familyArb, seedArb, (family, seed) => {
        const inTest = scoreGroup(
          groupDetections([makeDetection({ family, seed, path: 'tests/sample.spec.ts' })], TEST_SALT)[0]!,
          { inHead: false, publicRemote: false },
        ).score;
        const inSource = scoreGroup(
          groupDetections([makeDetection({ family, seed, path: 'src/index.ts' })], TEST_SALT)[0]!,
          { inHead: false, publicRemote: false },
        ).score;
        expect(inTest).toBeLessThanOrEqual(inSource);
      }),
      { numRuns: 50 },
    );
  });

  it('reste le barème exact de core, termes appliqués compris', () => {
    fc.assert(
      fc.property(familyArb, seedArb, fc.boolean(), fc.boolean(), (family, seed, inHead, publicRemote) => {
        const detection = makeDetection({ family, seed, path: 'src/app.ts' });
        fc.pre(!isDummyValue(detection.detection.value));
        const group = groupDetections([detection], TEST_SALT)[0]!;
        const actual = scoreGroup(group, { inHead, publicRemote });
        const expected = computeDangerScore({
          family,
          inHead,
          publicRemote,
          isTestPath: false,
          isDummyValue: false,
        });
        expect(actual).toEqual(expected);
      }),
      { numRuns: 50 },
    );
  });
});

describe('PLA-P-05 — déterminisme', () => {
  it('deux analyses des mêmes détections donnent le même rapport', () => {
    fc.assert(
      fc.asyncProperty(familyArb, seedArb, fc.integer({ min: 1, max: 4 }), async (family, seed, count) => {
        const detections = Array.from({ length: count }, (_, index) =>
          makeDetection({ family, seed, commitIndex: index, path: `src/f-${index}.ts` }),
        );
        const first = await analyze(makeInput(detections), makeOptions());
        const second = await analyze(makeInput(detections), makeOptions());
        expect(stringifyReport(second.report)).toBe(stringifyReport(first.report));
      }),
      { numRuns: 15 },
    );
  });
});

describe('PLA-P-01 — aucune valeur ne sort du moteur', () => {
  it('la valeur plantée n’apparaît jamais dans le rapport sérialisé', () => {
    fc.assert(
      fc.asyncProperty(familyArb, seedArb, async (family, seed) => {
        const value = fakeValue(family, seed);
        const detection = makeDetection({ family, seed, rawContext: true });
        const result = await analyze(makeInput([detection]), makeOptions());
        const serialized = stringifyReport(result.report);
        const escaped = JSON.stringify(value).slice(1, -1);
        expect(serialized).not.toContain(value);
        expect(serialized).not.toContain(escaped);
      }),
      { numRuns: 40 },
    );
  });
});

describe('PLA-P-12 — un commit sans secret ne change rien', () => {
  it('les trouvailles existantes sont identiques après ajout d’un commit muet', () => {
    fc.assert(
      fc.asyncProperty(familyArb, seedArb, async (family, seed) => {
        const detections = [makeDetection({ family, seed, commitIndex: 0 })];
        const before = await analyze(makeInput(detections), makeOptions());
        const after = await analyze(
          makeInput(detections, { headPresence: presenceMap('docs/notes.md') }),
          makeOptions(),
        );
        expect(after.report.findings).toEqual(before.report.findings);
      }),
      { numRuns: 15 },
    );
  });
});

describe('score — bornes', () => {
  it('reste dans l’intervalle 0..100', () => {
    fc.assert(
      fc.property(familyArb, seedArb, (family, _seed) => {
        const score = singleGroupScore(family, { path: 'tests/x.ts', inHead: true, publicRemote: true });
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(Number.isInteger(score)).toBe(true);
      }),
      { numRuns: 30 },
    );
  });
});
