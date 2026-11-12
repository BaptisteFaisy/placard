import type { ManorViewModel } from '@placard/core';

import { layoutManor, type ManorLayout } from './layout';

/**
 * Repli lisible pour les grands dépôts (exigence « 500 portes »).
 *
 * Au-delà de `maxDoors`, le SVG complet coûterait des milliers de nœuds sans
 * rien apporter : le manoir affiche alors un résumé textuel par étage et
 * renvoie au registre, qui contient **exactement les mêmes trouvailles**
 * (PLA-P-11). Le repli n'est pas une vue dégradée des données : c'est la même
 * donnée, présentée autrement.
 */

/** Seuil par défaut : au-delà, le manoir bascule sur le repli. */
export const MAX_RENDERED_DOORS = 500;

export interface ManorFallbackReason {
  needed: boolean;
  doors: number;
  limit: number;
}

/** Décide si le repli est nécessaire : au seuil atteint, le SVG s'efface. */
export function fallbackReason(model: ManorViewModel, maxDoors: number): ManorFallbackReason {
  return { needed: model.doorCount >= maxDoors, doors: model.doorCount, limit: maxDoors };
}

/** Une ligne de résumé par étage : année, portes, commits cachés dans les murs. */
export interface FloorSummaryLine {
  year: number;
  attic: boolean;
  ground: boolean;
  doors: number;
  wallCommits: number;
  findings: number;
}

/** Résumé d'un étage, sans construire de géométrie. */
export function summarizeFloors(model: ManorViewModel): FloorSummaryLine[] {
  return model.floors.map((floor) => {
    let doors = 0;
    let wallCommits = 0;
    for (const item of floor.items) {
      if (item.kind === 'door') doors += 1;
      else wallCommits += item.commits;
    }
    return {
      year: floor.year,
      attic: floor.attic,
      ground: floor.ground,
      doors,
      wallCommits,
      findings: floor.findings,
    };
  });
}

/** Position de l'étage dans la maison, en clair (grenier, rez-de-chaussée, entre-deux). */
export function floorPositionLabel(line: FloorSummaryLine): string {
  if (line.attic) return 'attic';
  if (line.ground) return 'ground floor';
  return 'upper floor';
}

/** Plan utilisé par le rendu, ou `null` si le repli s'applique. */
export function planFor(model: ManorViewModel, maxDoors: number): ManorLayout | null {
  return fallbackReason(model, maxDoors).needed ? null : layoutManor(model);
}
