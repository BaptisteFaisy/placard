import { rm } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FAMILIES } from './index';
import { RULE_IDS } from './rules';
import { dialectOf } from './templates';
import { makeRepo } from './testing';

/**
 * L'oracle annonce, pour chaque valeur plantée, la règle censée la détecter.
 *
 * Ces identifiants sont ceux de `@placard/detectors` (`RULE_IDS`) : l'oracle du
 * dépôt hanté et le rapport de l'analyse doivent parler la même langue, sinon
 * les tests croisés des deux lots ne pourraient pas se comparer.
 *
 * La vérification de bout en bout — la valeur plantée est-elle *réellement*
 * détectée par le moteur, avec cette règle ? — est faite par le lot
 * `detectors` et par le lot `analysis`, qui ont le moteur sous la main.
 */

const KNOWN_RULES: string[] = Object.values(RULE_IDS);

describe('règles attendues', () => {
  let dir: string;
  let planted: { family: string; expectedRule: string; value: string; path: string }[];

  beforeAll(async () => {
    const result = await makeRepo({ commits: 30, years: 1 });
    dir = result.repoDir;
    planted = result.planted;
  }, 180_000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('annonce toujours une règle du catalogue connu', () => {
    expect(planted.length).toBeGreaterThan(0);
    for (const secret of planted) {
      expect(KNOWN_RULES).toContain(secret.expectedRule);
    }
  });

  it('couvre chacune des neuf familles', () => {
    const byFamily = new Map<string, string>();
    for (const secret of planted) byFamily.set(secret.family, secret.expectedRule);
    expect(byFamily.size).toBe(FAMILIES.length);
    for (const family of FAMILIES) {
      expect(byFamily.get(family)).toBeTruthy();
    }
  });

  it('emploie une règle de mot de passe cohérente avec le dialecte du fichier', () => {
    const passwords = planted.filter((secret) => secret.family === 'plaintext-password');
    expect(passwords.length).toBeGreaterThan(0);
    for (const secret of passwords) {
      const isEnv = dialectOf(secret.path) === 'env';
      expect(secret.expectedRule).toBe(
        isEnv ? RULE_IDS.passwordEnv : RULE_IDS.passwordAssignment,
      );
    }
  });

  it('emploie une règle de donnée personnelle cohérente avec la forme de la valeur', () => {
    const identities = planted.filter((secret) => secret.family === 'identity');
    expect(identities.length).toBeGreaterThan(0);
    for (const secret of identities) {
      expect(secret.expectedRule).toBe(
        secret.value.includes('@') ? RULE_IDS.identityEmail : RULE_IDS.identityNir,
      );
    }
  });
});
