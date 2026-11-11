import { rm } from 'node:fs/promises';

import { afterAll, describe, expect, it } from 'vitest';

import { FAMILIES } from './index.js';
import { dialectOf } from './templates.js';
import { RULE_IDS } from './rules.js';
import { makeRepo } from './testing.js';

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
  const dirs: string[] = [];

  afterAll(async () => {
    for (const dir of dirs) await rm(dir, { recursive: true, force: true });
  });

  it('annonce toujours une règle du catalogue connu', async () => {
    const result = await makeRepo({ commits: 30, years: 1 });
    dirs.push(result.repoDir);
    expect(result.planted.length).toBeGreaterThan(0);
    for (const secret of result.planted) {
      expect(KNOWN_RULES).toContain(secret.expectedRule);
    }
  }, 180_000);

  it('couvre chacune des neuf familles', async () => {
    const result = await makeRepo({ commits: 30, years: 1 });
    dirs.push(result.repoDir);
    const byFamily = new Map<string, string>();
    for (const secret of result.planted) byFamily.set(secret.family, secret.expectedRule);
    expect(byFamily.size).toBe(FAMILIES.length);
    for (const family of FAMILIES) {
      expect(byFamily.get(family)).toBeTruthy();
    }
  }, 180_000);

  it('emploie une règle de mot de passe cohérente avec le dialecte du fichier', async () => {
    const result = await makeRepo({ commits: 30, years: 1 });
    dirs.push(result.repoDir);
    for (const secret of result.planted) {
      if (secret.family !== 'plaintext-password') continue;
      const isEnv = dialectOf(secret.path) === 'env';
      expect(secret.expectedRule).toBe(
        isEnv ? RULE_IDS.passwordEnv : RULE_IDS.passwordAssignment,
      );
    }
  }, 180_000);

  it('emploie une règle de donnée personnelle cohérente avec la forme de la valeur', async () => {
    const result = await makeRepo({ commits: 30, years: 1 });
    dirs.push(result.repoDir);
    for (const secret of result.planted) {
      if (secret.family !== 'identity') continue;
      expect(secret.expectedRule).toBe(
        secret.value.includes('@') ? RULE_IDS.identityEmail : RULE_IDS.identityNir,
      );
    }
  }, 180_000);
});
