import { severityOf } from '@placard/core';
import type {
  Finding,
  FindingFilter,
  FootprintTrail,
  ManorModelApi,
  ManorViewModel,
  PlacardReport,
  RegistryRow,
  RegistrySort,
  SeverityLevel,
} from '@placard/core';

import { applyFilters, emptyFilter, normalizeFilter } from './filters';
import { buildFloors, countItems } from './floors';
import { footprints } from './footprints';
import { buildHall } from './hall';
import { buildRegistryRows } from './registry';

/**
 * `@placard/manor-model` — modèle de présentation partagé du manoir et du
 * registre (PLA-F-14 à PLA-F-21, PLA-P-11, PLA-P-12).
 *
 * Le paquet est **pur** : aucune dépendance à React, aucun accès disque, aucune
 * horloge implicite (l'instant de référence est un paramètre). Il transforme un
 * rapport en un modèle prêt à rendre ; le rendu est le travail de `@placard/ui`.
 * Étant l'unique source de vérité des deux vues, il garantit qu'elles exposent
 * toujours le même ensemble de trouvailles pour un même filtre.
 */

export * from './dates';
export * from './doors';
export * from './filters';
export * from './floors';
export * from './footprints';
export * from './hall';
export * from './labels';
export * from './registry';

/**
 * Construit le modèle complet : étages, portes, hall, trouvailles filtrées.
 *
 * Une seule passe sur les trouvailles (index par commit et par empreinte) :
 * 500 portes restent fluides. `now` fixe l'âge des commits (toiles d'araignée)
 * et l'année du rez-de-chaussée ; il est explicite pour rester déterministe.
 */
export function buildViewModel(
  report: PlacardReport,
  filter: FindingFilter = emptyFilter(),
  now: Date = new Date(),
): ManorViewModel {
  const normalized = normalizeFilter(filter);
  const findings = applyFilters(report.findings, normalized);
  const floors = buildFloors(report, findings, now);
  const counts = countItems(floors);
  return {
    floors,
    hall: buildHall(report, findings),
    filter: normalized,
    findings,
    repo: report.repo,
    doorCount: counts.doors,
    wallCount: counts.walls,
  };
}

/** Interface publique du paquet, telle que figée par le contrat `core`. */
export function createManorModel(): ManorModelApi {
  return {
    buildViewModel,
    applyFilters,
    footprints,
    severityOf,
    emptyFilter,
    registryRows: buildRegistryRows,
  };
}

/** Instance partagée, prête à l'emploi pour les deux vues. */
export const manorModel: ManorModelApi = createManorModel();

export type {
  Finding,
  FindingFilter,
  FootprintTrail,
  ManorModelApi,
  ManorViewModel,
  PlacardReport,
  RegistryRow,
  RegistrySort,
  SeverityLevel,
};
