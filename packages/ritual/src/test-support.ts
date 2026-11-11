import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { computeFingerprint, fakeValue, redactPreview } from '@placard/core';
import type { Finding, FindingFamily, RitualOptions } from '@placard/core';

import { git } from './git-exec.js';

/**
 * Outillage des tests : valeurs fabriquées à l'exécution (PLA-N-09), dépôts
 * Git temporaires, options du rituel.
 */

export const SALT = 'placard-ritual-test-salt';

// Les tests ne dépendent jamais de la configuration Git globale de la machine
// (règle du brief) : elle est neutralisée dès le chargement du module.
process.env['GIT_CONFIG_GLOBAL'] = '/dev/null';
process.env['GIT_CONFIG_SYSTEM'] = '/dev/null';

/** Environnement Git isolé : aucun dépendance à la configuration globale. */
export function gitEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_AUTHOR_NAME: 'Placard Test',
    GIT_AUTHOR_EMAIL: 'test@placard.invalid',
    GIT_COMMITTER_NAME: 'Placard Test',
    GIT_COMMITTER_EMAIL: 'test@placard.invalid',
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00+0000',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00+0000',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    FILTER_BRANCH_SQUELCH_WARNING: '1',
  };
}

/** Lance git et lève si la commande échoue. */
export async function gitOrThrow(args: string[], cwd?: string): Promise<string> {
  const result = await git(args, { cwd, env: gitEnv() });
  if (!result.ok) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

export interface FindingSpec {
  family?: FindingFamily;
  rule?: string;
  id?: string;
  path?: string;
  line?: number;
  commit?: string;
}

/** Trouvaille construite autour d'une valeur connue du test. */
export function findingFor(value: string, spec: FindingSpec = {}): Finding {
  const family = spec.family ?? 'cloud-key';
  const commit = spec.commit ?? 'a'.repeat(40);
  return {
    id: spec.id ?? 'sk_0001',
    family,
    rule: spec.rule ?? 'aws-access-key',
    fingerprint: computeFingerprint(value, SALT),
    preview: redactPreview(value, family),
    danger: 82,
    reasons: ['test fixture'],
    inHead: true,
    introduced: { commit, shortCommit: commit.slice(0, 7), date: '2026-01-01T00:00:00.000Z' },
    removed: [],
    locations: [{ commit, path: spec.path ?? 'config.js', line: spec.line ?? 1 }],
    state: 'open',
  };
}

/** Trouvaille dont la valeur est fabriquée à l'exécution. */
export function fakeFinding(spec: FindingSpec & { seed?: string } = {}): Finding {
  const family = spec.family ?? 'cloud-key';
  const value = fakeValue(family, spec.seed ?? 'ritual-seed');
  return findingFor(value, { ...spec, family });
}

export interface RepoFixture {
  repoDir: string;
  value: string;
  filePath: string;
  head: string;
}

/** Dépôt Git temporaire contenant une valeur factice sur deux commits. */
export async function makeRepoWithSecret(
  value: string,
  filePath = 'config.js',
): Promise<RepoFixture> {
  const repoDir = await mkdtemp(join(tmpdir(), 'placard-repo-'));
  await gitOrThrow(['init', '-q', '-b', 'main'], repoDir);
  await writeFile(join(repoDir, filePath), `// app config\nconst apiKey = '${value}';\n`, 'utf8');
  await gitOrThrow(['add', '-A'], repoDir);
  await gitOrThrow(['commit', '-q', '-m', 'feat: add config'], repoDir);
  await writeFile(join(repoDir, filePath), `// app config\nconst apiKey = '${value}';\nconsole.log(apiKey);\n`, 'utf8');
  await gitOrThrow(['commit', '-q', '-am', 'feat: use config'], repoDir);
  const head = (await gitOrThrow(['rev-parse', 'HEAD'], repoDir)).trim();
  return { repoDir, value, filePath, head };
}

/** Options du rituel : `.placard` dans le dépôt, temporaires hors du dépôt. */
export async function makeOptions(repoDir?: string): Promise<RitualOptions> {
  const root = await mkdtemp(join(tmpdir(), 'placard-ritual-'));
  const repo = repoDir ?? join(root, 'repo');
  if (repoDir === undefined) await mkdir(repo, { recursive: true });
  const tmpDir = join(root, 'tmp');
  await mkdir(tmpDir, { recursive: true });
  return { repoDir: repo, placardDir: join(repo, '.placard'), tmpDir, toolVersion: '0.1.0' };
}
