import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { isDummyValue, isTestPath, luhnValid, mod97Valid, nirValid, shannonEntropy } from './checksums.js';
import { fakeCardNumber, fakeFrenchSsn, fakeIban, fakeValue, invalidChecksumVariant } from './fake-values.js';

describe('checksums & validations', () => {
  it('PLA-P-04: fakeIban produit un IBAN valide, sa variante invalide ne passe pas', () => {
    for (let i = 0; i < 20; i += 1) {
      const iban = fakeIban(() => Math.random());
      expect(mod97Valid(iban)).toBe(true);
      const broken = invalidChecksumVariant(iban, 'bank-data');
      expect(mod97Valid(broken)).toBe(false);
    }
  });

  it('PLA-P-04: fakeCardNumber valide Luhn, variante invalide rejetée', () => {
    for (let i = 0; i < 20; i += 1) {
      const card = fakeCardNumber(() => Math.random());
      expect(luhnValid(card)).toBe(true);
      const broken = invalidChecksumVariant(card, 'bank-data');
      expect(luhnValid(broken)).toBe(false);
    }
  });

  it('PLA-P-04: fakeFrenchSsn valide nirValid, variante invalide rejetée', () => {
    for (let i = 0; i < 20; i += 1) {
      const ssn = fakeFrenchSsn(() => Math.random());
      expect(nirValid(ssn)).toBe(true);
      const broken = invalidChecksumVariant(ssn, 'identity');
      expect(nirValid(broken)).toBe(false);
    }
  });

  it('shannonEntropy est nulle sur une répétition, élevée sur une chaîne variée', () => {
    expect(shannonEntropy('')).toBe(0);
    expect(shannonEntropy('aaaaa')).toBe(0);
    expect(shannonEntropy('abcdefghijklmnopqrstuvwxyz0123456789')).toBeGreaterThan(4.5);
  });

  it('isDummyValue repère les motifs triviaux sans faux secret en dur', () => {
    expect(isDummyValue('password')).toBe(true);
    expect(isDummyValue('changeme')).toBe(true);
    expect(isDummyValue('1234567890')).toBe(true);
    // Valeur construite à l'exécution : aucun littéral au format réel dans le dépôt (PLA-N-09).
    expect(isDummyValue(fakeValue('cloud-key', 'graine-dummy', 0))).toBe(false);
  });

  it('isTestPath identifie les dossiers et extensions de test', () => {
    expect(isTestPath('src/core/tests/foo.ts')).toBe(true);
    expect(isTestPath('packages/core/src/index.test.ts')).toBe(true);
    expect(isTestPath('examples/basic/index.ts')).toBe(true);
    expect(isTestPath('src/controllers/user.ts')).toBe(false);
  });

  it('fakeValue produit une chaîne non vide pour chaque famille (fast-check)', () => {
    const families = [
      'cloud-key',
      'platform-token',
      'private-key',
      'signed-token',
      'plaintext-password',
      'bank-data',
      'identity',
      'risky-file',
      'suspicious-string',
    ] as const;

    fc.assert(
      fc.property(fc.constantFrom(...families), fc.string({ minLength: 3 }), (family, seed) => {
        const val = fakeValue(family, seed, 0);
        return typeof val === 'string' && val.length > 5;
      }),
    );
  });
});
