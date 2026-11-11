import { isAbsolute, join, resolve } from 'node:path';

/**
 * Résolution des chemins de l'outil : le dossier `.placard/` (état local du
 * rituel, rapport, exclusions) et le rapport JSON. Tout est dérivé du dépôt
 * analysé, jamais de la position de lancement du processus.
 */

/** Nom du dossier d'état local de Placard dans un dépôt analysé. */
export const PLACARD_DIR_NAME = '.placard';

/** Chemin du rapport par défaut, relatif au dépôt. */
export const DEFAULT_REPORT_RELATIVE = `${PLACARD_DIR_NAME}/report.json`;

/** Chemin du fichier d'exclusions par défaut, relatif au dépôt. */
export const DEFAULT_IGNORE_RELATIVE = `${PLACARD_DIR_NAME}/ignore.yml`;

/** Nom du fichier de règles personnalisées, à la racine du dépôt. */
export const CUSTOM_RULES_FILE = 'placard.rules.json';

/** Dossier `.placard/` d'un dépôt (chemin absolu). */
export function resolvePlacardDir(repoDir: string): string {
  return resolve(repoDir, PLACARD_DIR_NAME);
}

/** Chemin du rapport par défaut d'un dépôt. */
export function defaultReportPath(repoDir: string): string {
  return join(resolvePlacardDir(repoDir), 'report.json');
}

/** Chemin du fichier d'exclusions par défaut d'un dépôt. */
export function defaultIgnorePath(repoDir: string): string {
  return join(resolvePlacardDir(repoDir), 'ignore.yml');
}

/**
 * Chemin du rapport demandé : l'option explicite d'abord (résolue telle quelle
 * si absolue, sinon depuis le dépôt), sinon le défaut du dépôt.
 */
export function resolveReportPath(repoDir: string, report?: string): string {
  if (report === undefined || report.trim() === '') return defaultReportPath(repoDir);
  return isAbsolute(report) ? resolve(report) : resolve(repoDir, report);
}

/** Chemin du fichier de règles personnalisées d'un dépôt (peut ne pas exister). */
export function resolveCustomRulesPath(repoDir: string): string {
  return resolve(repoDir, CUSTOM_RULES_FILE);
}
