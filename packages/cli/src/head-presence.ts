import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Présence dans la version courante du code (PLA-F-05).
 *
 * C'est ce qui décide le « +15 » du score et, dans le manoir, le squelette
 * **debout dans le hall** : un secret retiré du code mais toujours vivant dans
 * l'historique ne se tient pas debout ; un secret encore présent, si.
 *
 * Le contenu de HEAD est lu fichier par fichier et **ne quitte jamais cette
 * fonction** : seules des booléennes par chemin en sortent (PLA-N-02).
 */

const execFileAsync = promisify(execFile);

/** Taille maximale d'un fichier de HEAD lu pour la comparaison (5 Mo). */
const MAX_HEAD_FILE_BYTES = 5 * 1024 * 1024;

/** Une détection réduite à ce dont la présence a besoin. */
export interface PresenceInput {
  path: string;
  value: string;
}

/** Lit un fichier à HEAD ; `undefined` s'il n'existe pas ou est trop gros. */
async function readAtHead(repoDir: string, path: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['show', `HEAD:${path}`], {
      cwd: repoDir,
      encoding: 'latin1',
      maxBuffer: MAX_HEAD_FILE_BYTES,
      timeout: 20_000,
    });
    return stdout;
  } catch {
    return undefined;
  }
}

/** Regroupe les valeurs détectées par chemin, sans doublon. */
export function groupByPath(detections: readonly PresenceInput[]): Map<string, Set<string>> {
  const byPath = new Map<string, Set<string>>();
  for (const detection of detections) {
    if (detection.value.length === 0) continue;
    const values = byPath.get(detection.path);
    if (values === undefined) byPath.set(detection.path, new Set([detection.value]));
    else values.add(detection.value);
  }
  return byPath;
}

/**
 * Construit la carte `chemin → encore présent à HEAD ?` attendue par
 * `@placard/analysis`.
 *
 * Granularité assumée : le contrat d'analyse indexe la présence par **chemin**.
 * Un chemin est donc marqué présent si **au moins une** des valeurs qui y ont
 * été détectées s'y trouve encore — choix conservateur, dans le sens de la
 * sécurité : s'il reste un secret vivant dans le fichier, il faut le dire.
 */
export async function buildHeadPresence(
  repoDir: string,
  detections: readonly PresenceInput[],
): Promise<Map<string, boolean>> {
  const presence = new Map<string, boolean>();
  for (const [path, values] of groupByPath(detections)) {
    const content = await readAtHead(repoDir, path);
    if (content === undefined) {
      presence.set(path, false);
      continue;
    }
    let found = false;
    for (const value of values) {
      if (content.includes(value)) {
        found = true;
        break;
      }
    }
    presence.set(path, found);
  }
  return presence;
}
