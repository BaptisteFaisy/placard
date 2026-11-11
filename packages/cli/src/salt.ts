import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/**
 * Sel propre au dépôt (cahier C.6 : « un HMAC-SHA-256 de la valeur avec un sel
 * propre au dépôt »).
 *
 * Le sel est dérivé du **premier commit** du dépôt et de son nom : il est donc
 * stable dans le temps (les empreintes d'un même secret ne changent pas d'un
 * scan à l'autre, ce qui rend le fichier d'exclusions utilisable) et différent
 * d'un dépôt à l'autre (une empreinte ne peut pas être croisée entre dépôts).
 *
 * Le sel n'est jamais écrit : il ne sert qu'à calculer les empreintes.
 */

/** Premier commit atteignable depuis HEAD, ou `undefined` si le dépôt est vide. */
export function rootCommit(repoDir: string): string | undefined {
  try {
    const out = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
      cwd: repoDir,
      encoding: 'utf8',
      timeout: 15_000,
    });
    const first = out.split('\n')[0]?.trim();
    return first !== undefined && first.length >= 7 ? first : undefined;
  } catch {
    return undefined;
  }
}

/** Calcule le sel du dépôt à partir de son nom et de son premier commit. */
export function repoSalt(repoName: string, repoDir: string): string {
  const root = rootCommit(repoDir) ?? 'no-root-commit';
  return createHash('sha256').update(`${repoName}\u0000${root}`).digest('hex').slice(0, 32);
}
