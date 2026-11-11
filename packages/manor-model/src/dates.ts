/**
 * Arithmétique de dates du modèle de présentation.
 *
 * Toutes les dates du rapport sont des chaînes ISO 8601 ; le manoir les
 * manipule en UTC pour rester déterministe quel que soit le fuseau de la
 * machine qui rend la vue.
 */

/** Millisecondes dans une journée. */
export const DAY_MS = 86_400_000;

/** Horodatage d'une date ISO ; `0` si elle est illisible (jamais `NaN`). */
export function timeOf(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Année calendaire (UTC) d'une date ISO ; `0` si elle est illisible. */
export function yearOf(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return new Date(ms).getUTCFullYear();
}

/** Âge en jours entiers entre une date ISO et `now`, jamais négatif. */
export function ageInDays(iso: string, now: Date): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor((now.getTime() - ms) / DAY_MS));
}

/** Durée de vie en jours entiers entre deux dates ISO, jamais négative. */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}
