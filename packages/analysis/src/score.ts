import {
  computeDangerScore,
  isDummyValue,
  isTestPath,
  type ScoreResult,
} from '@placard/core';

import type { DetectionGroup } from './group';

/**
 * Score de danger d'une trouvaille (PLA-F-07, cahier C.6).
 *
 * Le calcul lui-même est **délégué à `computeDangerScore` de `@placard/core`** :
 * une seule implémentation dans tout le monorepo, donc une seule table de base
 * par famille et une seule règle d'ajustement. Ce module ne fait que décider
 * des entrées du calcul, au niveau du **groupe** et non de la détection.
 */

/** Contexte d'évaluation d'un groupe. */
export interface ScoreContext {
  /** Le dépôt a-t-il un distant public ? (+10) */
  publicRemote: boolean;
  /** La valeur est-elle encore présente dans HEAD ? (+15) */
  inHead: boolean;
}

/**
 * Un groupe est « de test » seulement si **tous** ses emplacements sont des
 * chemins de test ou d'exemple. C'est ce choix qui donne la monotonicité
 * attendue (PLA-P-07) : déplacer un emplacement d'un dossier de test vers un
 * chemin ordinaire ne peut jamais faire baisser le score, et un secret présent
 * à la fois dans un test et dans du code réel garde son score plein.
 */
export function isTestOnlyGroup(group: DetectionGroup): boolean {
  if (group.detections.length === 0) return false;
  return group.detections.every((detection) => isTestPath(detection.path));
}

/** Vrai si la valeur du groupe est une valeur factice connue (−20). */
export function isDummyGroup(group: DetectionGroup): boolean {
  return isDummyValue(group.value);
}

/**
 * Score et termes appliqués. `reasons` conserve **la liste des termes
 * réellement appliqués** : le score s'explique, ligne à ligne.
 */
export function scoreGroup(group: DetectionGroup, context: ScoreContext): ScoreResult {
  return computeDangerScore({
    family: group.family,
    inHead: context.inHead,
    publicRemote: context.publicRemote,
    isTestPath: isTestOnlyGroup(group),
    isDummyValue: isDummyGroup(group),
  });
}
