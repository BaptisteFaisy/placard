import { formatPlant, lineOf, renderTemplate, type PlantLine } from './plant.js';
import type { PlannedSecret } from './plan.js';
import { baseFiles, type FileContent } from './noise.js';
import { templateFor, templatePaths } from './templates.js';

/**
 * Arbre de travail en mémoire.
 *
 * Le dépôt synthétique est modélisé par une simple table `chemin → contenu`,
 * plus, pour chaque fichier modèle, la liste ordonnée des blocs plantés encore
 * actifs. C'est cette liste qui permet de calculer **exactement** le numéro de
 * ligne d'une valeur au commit où elle est introduite, sans jamais relire le
 * fichier sur disque.
 */

/** État complet du dépôt en cours de génération. */
export interface RepoTree {
  /** Contenu courant de chaque fichier. */
  files: Map<string, FileContent>;
  /** Blocs plantés actifs, par chemin de fichier modèle. */
  plants: Map<string, PlantLine[]>;
  /** Numéro de ligne de la valeur, par identifiant de secret. */
  lines: Map<string, number>;
}

const STANDALONE_CONTENT = [
  '# Local overrides for this environment.',
  'NODE_ENV=development',
  'DEBUG=1',
  '',
].join('\n');

function renderPath(tree: RepoTree, path: string): void {
  const template = templateFor(path);
  if (template === undefined) return;
  tree.files.set(path, renderTemplate(template, tree.plants.get(path) ?? []));
}

/** Crée l'arbre initial : fichiers de base et fichiers modèles encore vides. */
export function createTree(): RepoTree {
  const tree: RepoTree = { files: baseFiles(), plants: new Map(), lines: new Map() };
  for (const path of templatePaths()) {
    tree.plants.set(path, []);
    renderPath(tree, path);
  }
  return tree;
}

function plantAt(tree: RepoTree, secret: PlannedSecret, path: string): number {
  const template = templateFor(path);
  if (template === undefined) return 1;
  const block = formatPlant(secret.family, secret.value, secret.key, template.dialect);
  const active = tree.plants.get(path) ?? [];
  const line = lineOf(template, active, block);
  active.push({ id: `${secret.id}@${path}`, ...block });
  tree.plants.set(path, active);
  renderPath(tree, path);
  return line;
}

function plantStandalone(tree: RepoTree, secret: PlannedSecret): void {
  for (const path of secret.paths) tree.files.set(path, STANDALONE_CONTENT);
  tree.lines.set(secret.id, 1);
}

/** Plante une valeur à tous ses emplacements ; retient la ligne du premier. */
export function plantSecret(tree: RepoTree, secret: PlannedSecret): void {
  if (secret.standalone) {
    plantStandalone(tree, secret);
    return;
  }
  secret.paths.forEach((path, position) => {
    const line = plantAt(tree, secret, path);
    if (position === 0) tree.lines.set(secret.id, line);
  });
}

/** Retire une valeur de tous ses emplacements (arc de vie court ou long). */
export function removeSecret(tree: RepoTree, secret: PlannedSecret): void {
  if (secret.standalone) {
    for (const path of secret.paths) tree.files.delete(path);
    return;
  }
  for (const path of secret.paths) {
    const active = tree.plants.get(path) ?? [];
    tree.plants.set(
      path,
      active.filter((plant) => plant.id !== `${secret.id}@${path}`),
    );
    renderPath(tree, path);
  }
}
