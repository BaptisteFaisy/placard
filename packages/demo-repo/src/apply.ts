import {
  applyNoise,
  BINARY_ASSET_PATH,
  binaryAsset,
  LARGE_ASSET_PATH,
  largeAsset,
} from './noise';
import type { RepoPlan } from './plan';
import { plantSecret, removeSecret, type RepoTree } from './tree';

/**
 * Application d'un commit du plan à l'arbre en mémoire.
 *
 * L'ordre est significatif : d'abord les introductions, puis les retraits, puis
 * le bruit. Les fichiers ajoutés hors modèles (binaire, volumineux, fichiers à
 * risque) le sont au commit prévu par le plan.
 */
export function applyCommit(tree: RepoTree, plan: RepoPlan, index: number): void {
  if (index === plan.binaryAt) tree.files.set(BINARY_ASSET_PATH, binaryAsset());
  if (index === plan.largeAt) tree.files.set(LARGE_ASSET_PATH, largeAsset());
  for (const secret of plan.secrets) {
    if (secret.introIndex === index) plantSecret(tree, secret);
  }
  for (const secret of plan.secrets) {
    if (secret.removeIndex === index) removeSecret(tree, secret);
  }
  for (const op of plan.noise[index] ?? []) applyNoise(tree.files, op);
}
