import { isTestPath, type PlantedSecret } from '@placard/core';

import type { PlannedSecret } from './plan.js';

/**
 * Construction de l'oracle.
 *
 * `PlantedSecret[]` est la vérité terrain du dépôt synthétique : le générateur
 * est le seul à savoir quoi, où et quand. Les SHA sont ceux des commits
 * réellement créés, résolus après coup.
 */

/** Assemble l'oracle à partir du plan, des SHA créés et des lignes relevées. */
export function buildOracle(
  secrets: readonly PlannedSecret[],
  shas: readonly string[],
  dates: readonly Date[],
  lines: ReadonlyMap<string, number>,
): PlantedSecret[] {
  return secrets.map((secret) => toPlanted(secret, shas, dates, lines));
}

function toPlanted(
  secret: PlannedSecret,
  shas: readonly string[],
  dates: readonly Date[],
  lines: ReadonlyMap<string, number>,
): PlantedSecret {
  const path = secret.paths[0] ?? '';
  const introducedCommit = shas[secret.introIndex];
  const removedCommit =
    secret.removeIndex === undefined ? undefined : shas[secret.removeIndex];
  const date = dates[secret.introIndex] ?? new Date(0);
  return {
    id: secret.id,
    family: secret.family,
    expectedRule: secret.expectedRule,
    // Pour un fichier à risque, la « valeur » que le moteur empreinte est le
    // **chemin entier** (deux fichiers distincts ne doivent jamais partager une
    // empreinte) : l'oracle doit porter la même valeur, sinon la comparaison
    // d'empreintes échoue alors que la trouvaille est bien là.
    value: secret.family === 'risky-file' ? path : secret.value,
    path,
    line: lines.get(secret.id) ?? 1,
    introducedCommit,
    removedCommit,
    inHead: removedCommit === undefined,
    locations: secret.paths.length,
    testPath: isTestPath(path),
    date: date.toISOString(),
  };
}
