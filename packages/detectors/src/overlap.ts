import type { RawDetection } from '@placard/core';

/**
 * Résolution des chevauchements (cahier C.6, dernier étage).
 *
 * Plusieurs règles peuvent reconnaître la même valeur : une clé de service en
 * nuage est aussi une « longue chaîne à forte entropie », une URL avec
 * identifiants contient parfois une adresse électronique. Règle de départage :
 *
 *  1. la priorité de la règle (la plus haute gagne) ;
 *  2. à priorité égale, la confiance déclarée par la règle ;
 *  3. à confiance égale, la valeur la plus longue (la plus spécifique) ;
 *  4. à longueur égale, la première occurrence dans la ligne.
 *
 * Une valeur ne produit ainsi qu'**une seule** détection, et deux détections
 * distinctes ne se recouvrent jamais.
 */

/** Priorité par identifiant de règle (0 si la règle n'en déclare pas). */
export type Priorities = ReadonlyMap<string, number>;

/** Deux intervalles se recouvrent-ils ? (`end` est exclusif) */
export function overlaps(a: RawDetection, b: RawDetection): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Longueur de la valeur détectée. */
function spanLength(detection: RawDetection): number {
  return detection.end - detection.start;
}

/** Comparateur de départage : négatif si `a` doit être conservé avant `b`. */
export function compareDetections(
  priorities: Priorities,
  a: RawDetection,
  b: RawDetection,
): number {
  const priorityDelta = (priorities.get(b.rule) ?? 0) - (priorities.get(a.rule) ?? 0);
  if (priorityDelta !== 0) return priorityDelta;
  const confidenceDelta = b.confidence - a.confidence;
  if (confidenceDelta !== 0) return confidenceDelta;
  const lengthDelta = spanLength(b) - spanLength(a);
  if (lengthDelta !== 0) return lengthDelta;
  return a.start - b.start;
}

/**
 * Ne conserve que les détections gagnantes, puis les rend dans l'ordre de la
 * ligne (indice de début croissant) pour un parcours déterministe.
 */
export function resolveOverlaps(
  detections: readonly RawDetection[],
  priorities: Priorities,
): RawDetection[] {
  const candidates = detections
    .filter((detection) => detection.end > detection.start)
    .sort((a, b) => compareDetections(priorities, a, b));

  const kept: RawDetection[] = [];
  for (const candidate of candidates) {
    if (!kept.some((winner) => overlaps(winner, candidate))) kept.push(candidate);
  }

  return kept.sort((a, b) => a.start - b.start || b.end - a.end);
}
