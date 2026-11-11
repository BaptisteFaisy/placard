import { severityOf } from '@placard/core';
import type { Finding, FindingFilter } from '@placard/core';

import { yearOf } from './dates.js';

/**
 * Filtres communs au manoir et au registre (PLA-F-19).
 *
 * **Une seule implémentation** : `applyFilters` sert aux deux vues, ce qui
 * garantit PLA-P-11 (pour tout jeu de filtres, les deux vues exposent
 * exactement le même ensemble de trouvailles).
 */

/** Filtre vide : aucun critère, donc toutes les trouvailles. */
export function emptyFilter(): FindingFilter {
  return { severities: [], families: [], states: [] };
}

/**
 * Complète un filtre partiel venu de l'interface (listes absentes = aucun
 * critère). Copie les tableaux : le filtre du modèle n'est jamais un alias de
 * celui de l'appelant.
 */
export function normalizeFilter(filter?: Partial<FindingFilter> | FindingFilter): FindingFilter {
  const source = filter ?? {};
  return {
    severities: [...(source.severities ?? [])],
    families: [...(source.families ?? [])],
    states: [...(source.states ?? [])],
    inHead: source.inHead,
    fromYear: source.fromYear,
    toYear: source.toYear,
    query: source.query,
  };
}

/** Année de référence d'une trouvaille : celle de son commit d'introduction. */
export function findingYear(finding: Finding): number {
  return yearOf(finding.introduced.date);
}

/** Recherche texte sur l'aperçu masqué, le chemin ou la règle — jamais la valeur. */
function matchesQuery(finding: Finding, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  if (finding.preview.toLowerCase().includes(needle)) return true;
  if (finding.rule.toLowerCase().includes(needle)) return true;
  return finding.locations.some((location) => location.path.toLowerCase().includes(needle));
}

/** Vrai si la trouvaille satisfait tous les critères actifs du filtre. */
export function matchesFilter(finding: Finding, filter: FindingFilter): boolean {
  const { severities, families, states } = filter;
  if (severities.length > 0 && !severities.includes(severityOf(finding.danger))) return false;
  if (families.length > 0 && !families.includes(finding.family)) return false;
  if (states.length > 0 && !states.includes(finding.state)) return false;
  if (filter.inHead !== undefined && finding.inHead !== filter.inHead) return false;
  const year = findingYear(finding);
  if (filter.fromYear !== undefined && year < filter.fromYear) return false;
  if (filter.toYear !== undefined && year > filter.toYear) return false;
  if (filter.query !== undefined && !matchesQuery(finding, filter.query)) return false;
  return true;
}

/** Applique un filtre à une liste de trouvailles (implémentation unique). */
export function applyFilters(findings: readonly Finding[], filter: FindingFilter): Finding[] {
  const normalized = normalizeFilter(filter);
  return findings.filter((finding) => matchesFilter(finding, normalized));
}
