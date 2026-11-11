import { fakeValue, type DemoRepoGenerator, type GenerateOptions, type GenerateResult } from '@placard/core';

import { applyCommit } from './apply.js';
import { addPublicRemote, commitAll, initRepo, revList, syncTree } from './commit.js';
import type { FileContent } from './noise.js';
import { buildOracle } from './oracle.js';
import { buildPlan } from './plan.js';
import { createTree } from './tree.js';

/**
 * `@placard/demo-repo` — générateur de dépôt hanté.
 *
 * Fabrique, à partir d'une graine fixe, un dépôt Git synthétique contenant des
 * secrets factices de chaque famille, plantés à des dates et durées variées
 * (PLA-F-13). Le générateur est le seul à connaître la vérité terrain : il la
 * rend sous forme d'oracle (`GenerateResult.planted`) pour les tests par
 * propriétés et pour la démonstration.
 *
 * Règle absolue (PLA-N-09) : aucune valeur factice au format réel n'est écrite
 * dans ce paquet. Toutes viennent de `fakeValue` de `@placard/core`, à
 * l'exécution, et ne vivent que dans le dépôt temporaire généré.
 */

export type {
  DemoRepoGenerator,
  GenerateOptions,
  GenerateResult,
  PlantedSecret,
} from '@placard/core';

export { FAMILIES } from './plan.js';
export type { RepoPlan } from './plan.js';

const DEFAULT_SEED = 'placard-demo';

/** Fabrique une valeur factice d'une famille, à partir d'une graine. */
export function fakeValueFor(family: Parameters<typeof fakeValue>[0], seed: string, index = 0): string {
  return fakeValue(family, seed, index);
}

/** Génère un dépôt hanté complet et rend son oracle. */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const seed = options.seed ?? DEFAULT_SEED;
  const plan = buildPlan({
    seed,
    commits: options.commits,
    years: options.years,
    secrets: options.secrets,
    headDate: options.headDate,
    publicRemote: options.publicRemote,
  });
  await initRepo(options.targetDir);
  const tree = createTree();
  const written = new Map<string, FileContent>();
  for (let index = 0; index < plan.totalCommits; index += 1) {
    applyCommit(tree, plan, index);
    await syncTree(options.targetDir, tree.files, written);
    const date = plan.dates[index] ?? new Date(0);
    const message = plan.messages[index] ?? 'chore: tidy up';
    await commitAll(options.targetDir, date, message);
  }
  // Un seul parcours de l'historique suffit : les SHA sont lus d'un coup,
  // du plus ancien au plus récent. Cela évite un processus Git par commit.
  const shas = await revList(options.targetDir);
  if (plan.publicRemote) await addPublicRemote(options.targetDir);
  return {
    repoDir: options.targetDir,
    seed,
    commits: plan.totalCommits,
    planted: buildOracle(plan.secrets, shas, plan.dates, tree.lines),
    head: shas[shas.length - 1] ?? '',
  };
}

/** Construit l'implémentation de l'interface publique du paquet. */
export function createDemoRepoGenerator(): DemoRepoGenerator {
  return {
    generate,
    fakeValue: (family, seed, index = 0) => fakeValue(family, seed, index),
  };
}

/** Implémentation partagée, prête à l'emploi. */
export const demoRepoGenerator: DemoRepoGenerator = createDemoRepoGenerator();
