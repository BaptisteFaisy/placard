import {
  fakeCardNumber,
  fakeFrenchSsn,
  fakeIban,
  fakeValue,
  invalidChecksumVariant,
  prng,
} from '@placard/core';
import type { FindingFamily } from '@placard/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { createDetectorEngine } from './index.js';
import { RULE_IDS } from './registry.js';
import {
  apiKeyLine,
  assignmentLine,
  inputOf,
  passwordLine,
  urlWithCredentials,
} from './testing/fixtures.js';

/**
 * Propriétés PLA-P-04 (et rappel PLA-P-02) vérifiées par fast-check.
 *
 * Toutes les valeurs sont **fabriquées à l'exécution** (PLA-N-09) : les
 * générateurs fast-check ne produisent qu'une graine, la valeur vient de
 * `@placard/core`.
 */

const engine = createDetectorEngine();

/**
 * Nombre d'exécutions par propriété : assez pour mordre, borné pour la CI.
 * La graine est **fixe** : une propriété fast-check doit être rejouable, sinon
 * une CI rouge un jour sur un cas limite devient un flou irrattrapable.
 */
const RUNS = 120;
const FC_SEED = 20261111;

/** Une graine arbitraire, exploitable par les fabriques déterministes. */
const seedArb = fc.stringMatching(/^[a-z0-9]{1,12}$/);

/** Détecte une valeur dans une ligne et renvoie les règles trouvées. */
function rulesFor(line: string): string[] {
  return engine.scanLine(inputOf(line)).detections.map((detection) => detection.rule);
}

/**
 * Contexte minimal attendu par chaque famille : un mot de passe n'a de sens
 * que dans une affectation, une chaîne suspecte que près d'un mot-clé.
 */
const CONTEXT: Record<FindingFamily, (value: string) => string> = {
  'cloud-key': (value) => apiKeyLine(value),
  'platform-token': (value) => assignmentLine('token', value),
  'private-key': (value) => value.split('\n')[0] ?? '',
  'signed-token': (value) => assignmentLine('token', value),
  'plaintext-password': (value) => passwordLine(value),
  'bank-data': (value) => `account ${value}`,
  identity: (value) => `contact ${value}`,
  'risky-file': (value) => `config/${value}`,
  'suspicious-string': (value) => apiKeyLine(value),
};

/** Ligne de contexte d'une famille, sans dépendre du tirage aléatoire. */
function lineFor(family: FindingFamily, seed: string): string {
  return CONTEXT[family](fakeValue(family, seed, 0));
}

describe('PLA-P-04: valid checksums are detected, invalid variants are not', () => {
  it('always detects a valid IBAN and never its broken variant', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const iban = fakeIban(prng(seed));
        const broken = invalidChecksumVariant(iban, 'bank-data');
        expect(rulesFor(`account ${iban}`)).toContain(RULE_IDS.bankIban);
        expect(rulesFor(`account ${broken}`)).not.toContain(RULE_IDS.bankIban);
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });

  it('always detects a valid card number and never its broken variant', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const card = fakeCardNumber(prng(seed));
        const broken = invalidChecksumVariant(card, 'bank-data');
        expect(rulesFor(`card ${card}`)).toContain(RULE_IDS.bankCard);
        expect(rulesFor(`card ${broken}`)).not.toContain(RULE_IDS.bankCard);
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });

  it('always detects a valid NIR and never its broken variant', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const ssn = fakeFrenchSsn(prng(seed));
        const broken = invalidChecksumVariant(ssn, 'identity');
        expect(rulesFor(`nir ${ssn}`)).toContain(RULE_IDS.identityNir);
        expect(rulesFor(`nir ${broken}`)).not.toContain(RULE_IDS.identityNir);
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });

  it('never reports a bank or identity value whose checksum was broken', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const iban = invalidChecksumVariant(fakeIban(prng(seed)), 'bank-data');
        const card = invalidChecksumVariant(fakeCardNumber(prng(seed)), 'bank-data');
        const ssn = invalidChecksumVariant(fakeFrenchSsn(prng(seed)), 'identity');
        expect(rulesFor(`account ${iban}`)).not.toContain(RULE_IDS.bankIban);
        expect(rulesFor(`card ${card}`)).not.toContain(RULE_IDS.bankCard);
        expect(rulesFor(`nir ${ssn}`)).not.toContain(RULE_IDS.identityNir);
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });
});

describe('PLA-P-02: every family is reachable', () => {
  const families: FindingFamily[] = [
    'cloud-key',
    'platform-token',
    'private-key',
    'signed-token',
    'plaintext-password',
    'bank-data',
    'identity',
    'suspicious-string',
  ];

  it.each(families)('detects a %s value, whatever the seed', (family) => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const detections = engine.scanLine(inputOf(lineFor(family, seed))).detections;
        expect(detections.length).toBeGreaterThan(0);
        expect(detections[0]?.family).toBeDefined();
      }),
      { numRuns: 40, seed: FC_SEED },
    );
  });

  it('detects credentials in a URL for any generated password', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const password = fakeValue('plaintext-password', seed, 1);
        const rules = rulesFor(urlWithCredentials('app_user', password));
        expect(rules.length).toBeGreaterThan(0);
      }),
      { numRuns: 40, seed: FC_SEED },
    );
  });
});

describe('detector invariants (fast-check)', () => {
  it('never returns overlapping detections', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (line) => {
        const detections = engine.scanLine(inputOf(line)).detections;
        for (let i = 0; i < detections.length; i += 1) {
          for (let j = i + 1; j < detections.length; j += 1) {
            const a = detections[i]!;
            const b = detections[j]!;
            expect(a.start < b.end && b.start < a.end).toBe(false);
          }
        }
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });

  it('always returns spans inside the line, with a non-empty value', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (line) => {
        for (const detection of engine.scanLine(inputOf(line)).detections) {
          expect(detection.start).toBeGreaterThanOrEqual(0);
          expect(detection.end).toBeLessThanOrEqual(line.length);
          expect(detection.end).toBeGreaterThan(detection.start);
          expect(detection.value.length).toBeGreaterThan(0);
          expect(line.slice(detection.start, detection.end)).toBe(detection.value);
        }
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });

  it('never throws on arbitrary input (PLA-P-10)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (line) => {
        expect(() => engine.scanLine(inputOf(line))).not.toThrow();
        expect(() => engine.scanPath(line)).not.toThrow();
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });

  it('is deterministic for identical input (PLA-P-05)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (line) => {
        const first = engine.scanLine(inputOf(line)).detections;
        const second = engine.scanLine(inputOf(line)).detections;
        expect(first).toEqual(second);
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });

  it('reports every detection with a bounded confidence', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (line) => {
        for (const detection of engine.scanLine(inputOf(line)).detections) {
          expect(detection.confidence).toBeGreaterThan(0);
          expect(detection.confidence).toBeLessThanOrEqual(1);
        }
      }),
      { numRuns: RUNS, seed: FC_SEED },
    );
  });
});
