import type { AnchoredDetection, CommitEvent } from '@placard/core';

import { sortDetections } from './group.js';

/**
 * Durée de vie d'un secret (PLA-F-05).
 *
 * Le lecteur d'historique livre les lignes **ajoutées et retirées** : une
 * détection sur une ligne retirée est donc, en pratique, la trace d'un retrait.
 * Le moteur n'a pas besoin de le savoir explicitement : pour chaque fichier, la
 * **dernière** détection est le dernier commit où la valeur y a été vue. Si ce
 * fichier ne porte plus la valeur dans HEAD, ce commit est le retrait.
 *
 * Reconstruire ainsi plutôt que de dater « le premier commit où la valeur
 * disparaît » évite toute dépendance à des commits sans détection : ajouter un
 * commit qui ne touche à aucun secret ne change donc aucune trouvaille
 * (PLA-P-12).
 */

/** Décide si une détection est encore présente dans la version courante. */
export type HeadPresence = (detection: AnchoredDetection) => boolean;

/** Durée de vie reconstituée d'une trouvaille. */
export interface Lifetime {
  introduced: CommitEvent;
  /** Commits de retrait, triés du plus ancien au plus récent. */
  removed: CommitEvent[];
  inHead: boolean;
  /** Jours entre l'introduction et le retrait (ou la dernière observation). */
  lifetimeDays: number;
}

/** Millisecondes dans une journée. */
const DAY_MS = 86_400_000;

/**
 * Construit la fonction de présence dans HEAD à partir de la carte fournie par
 * l'appelant. Une clé peut être un **chemin** (`src/app.ts`) ou un **SHA de
 * commit** : la carte du contrat porte « SHA et contenu courant des fichiers
 * de HEAD », les deux conventions sont donc acceptées. Une clé absente vaut
 * « pas dans HEAD » — jamais l'inverse : on ne déclare pas un secret présent
 * sans preuve.
 */
export function makePresence(map: ReadonlyMap<string, boolean>): HeadPresence {
  return (detection) => map.get(detection.path) ?? map.get(detection.commit.commit) ?? false;
}

/** Nombre de jours entiers entre deux dates ISO 8601 (jamais négatif). */
export function daysBetween(startIso: string, endIso: string): number {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

/**
 * Dernière détection de chaque fichier : le dernier commit où la valeur y a
 * été vue, donc le candidat naturel au retrait pour ce fichier.
 */
export function lastSightingPerPath(
  detections: readonly AnchoredDetection[],
): Map<string, AnchoredDetection> {
  const last = new Map<string, AnchoredDetection>();
  for (const detection of sortDetections(detections)) last.set(detection.path, detection);
  return last;
}

/** Retraits : fichiers dont la dernière observation n'est plus dans HEAD. */
function removalsOf(
  detections: readonly AnchoredDetection[],
  presence: HeadPresence,
  introduced: CommitEvent,
): CommitEvent[] {
  const candidates = new Map<string, CommitEvent>();
  for (const sighting of lastSightingPerPath(detections).values()) {
    if (presence(sighting)) continue;
    if (sighting.commit.commit === introduced.commit) continue;
    candidates.set(sighting.commit.commit, sighting.commit);
  }
  return [...candidates.values()].sort((a, b) => a.index - b.index);
}

/**
 * Reconstitue la durée de vie d'un groupe : commit d'introduction, commits de
 * retrait, présence dans HEAD et durée en jours.
 */
export function resolveLifetime(
  detections: readonly AnchoredDetection[],
  presence: HeadPresence,
): Lifetime {
  const sorted = sortDetections(detections);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error('resolveLifetime: at least one detection is required');
  }

  const introduced = first.commit;
  const inHead = sorted.some((detection) => presence(detection));
  const removed = removalsOf(sorted, presence, introduced);

  // La durée de vie court de l'introduction au retrait, ou à la dernière
  // observation si le secret est encore dans HEAD.
  const endDate = removed[0]?.date ?? last.commit.date;
  return {
    introduced,
    removed,
    inHead,
    lifetimeDays: daysBetween(introduced.date, endDate),
  };
}
