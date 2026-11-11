import { daysBetween } from '@placard/manor-model';
import type { Finding } from '@placard/core';

/**
 * Données dérivées de la fiche.
 *
 * Une seule implémentation de la durée de vie, partagée par la fiche et le
 * registre : la même trouvaille annonce la même durée partout.
 */

/** Dernier retrait connu d'une trouvaille, sinon `undefined`. */
export function lastRemoval(finding: Finding): string | undefined {
  let latest: string | undefined;
  for (const removed of finding.removed) {
    if (latest === undefined || Date.parse(removed.date) > Date.parse(latest)) latest = removed.date;
  }
  return latest;
}

/**
 * Durée de vie en jours : de l'introduction au dernier retrait connu, ou
 * jusqu'à `now` si le secret n'a jamais été retiré. Jamais négative.
 */
export function lifetimeDaysOf(finding: Finding, now: Date): number {
  const end = lastRemoval(finding) ?? now.toISOString();
  return daysBetween(finding.introduced.date, end);
}

/** Vrai si le secret vit encore : présent dans HEAD ou jamais retiré. */
export function isStillAlive(finding: Finding): boolean {
  return finding.inHead || finding.removed.length === 0;
}
