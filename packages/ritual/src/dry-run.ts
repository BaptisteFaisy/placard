import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { git, run } from './git-exec.js';

/**
 * Essai à blanc (PLA-F-25).
 *
 * Le script de purge est exécuté sur un **clone miroir temporaire** : le dépôt
 * de l'utilisateur n'est jamais touché, même en cas de bug du script.
 */

export type RewriteMethod = 'git-filter-repo' | 'git-filter-branch' | 'none';

export interface DryRunOptions {
  /** Conserver le miroir réécrit (l'appelant le supprime lui-même). */
  keepMirror?: boolean;
  /** Dossier de travail imposé ; sinon `mkdtemp`. */
  workDir?: string;
}

export interface DryRunResult {
  method: RewriteMethod;
  commitsBefore: number;
  commitsAfter: number;
  /** Commits dont l'identifiant a changé. */
  rewritten: number;
  /** Commits devenus vides et supprimés par `--prune-empty`. */
  dropped: number;
  /** Chemin du miroir réécrit, si `keepMirror`. */
  mirrorDir: string;
}

const COUNT_TIMEOUT = 60_000;

/** Quel moteur de réécriture est disponible sur cette machine ? */
export async function detectRewriteTool(): Promise<RewriteMethod> {
  const filterRepo = await git(['filter-repo', '--version'], { timeoutMs: 20_000 });
  if (filterRepo.ok) return 'git-filter-repo';
  const python = await run('python3', ['--version'], { timeoutMs: 20_000 });
  if (python.ok) return 'git-filter-branch';
  return 'none';
}

async function commitList(repo: string): Promise<string[]> {
  const result = await git(['-C', repo, 'rev-list', '--all'], { timeoutMs: COUNT_TIMEOUT });
  return result.ok ? result.stdout.split('\n').filter((line) => line.length > 0) : [];
}

async function makeMirror(repoDir: string, workDir: string): Promise<string | undefined> {
  const mirror = join(workDir, 'mirror.git');
  const clone = await git(['clone', '--mirror', repoDir, mirror], { timeoutMs: COUNT_TIMEOUT });
  return clone.ok ? mirror : undefined;
}

function countRewritten(before: readonly string[], after: readonly string[]): number {
  const kept = new Set(after);
  return before.filter((sha) => !kept.has(sha)).length;
}

/**
 * Exécute le script de purge sur un clone miroir jetable et compte les commits
 * réécrits. Aucune valeur ne remonte : seuls des compteurs et le moteur utilisé.
 */
export async function dryRun(
  repoDir: string,
  scriptPath: string,
  options: DryRunOptions = {},
): Promise<DryRunResult> {
  const method = await detectRewriteTool();
  if (method === 'none') {
    throw new Error(
      'Dry run needs git filter-repo or python3 (for the git filter-branch fallback); neither was found.',
    );
  }
  const workDir = options.workDir ?? (await mkdtemp(join(tmpdir(), 'placard-dryrun-')));
  const mirror = await makeMirror(repoDir, workDir);
  if (mirror === undefined) {
    if (options.workDir === undefined) await rm(workDir, { recursive: true, force: true });
    throw new Error('Dry run failed: the mirror clone could not be created.');
  }
  const before = await commitList(mirror);
  const executed = await run('sh', [scriptPath, mirror], {
    env: { ...process.env, FILTER_BRANCH_SQUELCH_WARNING: '1' },
  });
  if (!executed.ok) {
    if (options.workDir === undefined) await rm(workDir, { recursive: true, force: true });
    // Le message ne recopie pas la sortie du script : elle peut citer des chemins
    // et, par accident, des fragments de contenu (PLA-N-02).
    throw new Error(`Dry run failed: the purge script exited with code ${String(executed.code)}.`);
  }
  const after = await commitList(mirror);
  const result: DryRunResult = {
    method,
    commitsBefore: before.length,
    commitsAfter: after.length,
    rewritten: countRewritten(before, after),
    dropped: Math.max(0, before.length - after.length),
    mirrorDir: options.keepMirror === true ? mirror : '',
  };
  if (options.keepMirror !== true && options.workDir === undefined) {
    await rm(workDir, { recursive: true, force: true });
  }
  return result;
}
