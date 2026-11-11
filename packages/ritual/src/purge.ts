import { chmod, mkdir, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import type { Finding, PurgeArtifacts, RitualOptions } from '@placard/core';

import { isPersonalData } from './families.js';
import {
  buildFallbackHelper,
  buildPurgeScript,
  buildReplacementsFile,
  REPLACEMENT_MARKER,
} from './purge-script.js';
import { loadState } from './state.js';
import { recoverValue } from './value-recovery.js';

/**
 * Génération du script de purge (PLA-F-24).
 *
 * L'outil n'exécute JAMAIS la réécriture sur le dépôt de l'utilisateur : il
 * écrit un script et un fichier de remplacements hors du dépôt, puis rend les
 * commandes à relire.
 */

/** Levée quand la rotation n'est pas validée : la purge reste verrouillée. */
export class PurgeLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PurgeLockedError';
  }
}

/** Message de verrou, sans aucune valeur (PLA-N-02). */
export function lockMessage(finding: Finding): string {
  const verb = isPersonalData(finding.family)
    ? 'evaluate the exposure first (step 1: declare it not applicable with a reason)'
    : 'rotate the credential first (step 1: mark it rotated)';
  return (
    `Purge is locked for finding ${finding.id} (rule ${finding.rule}): ${verb}. ` +
    'A purge without rotation leaves a live secret in the wild.'
  );
}

/** Vérifie que chaque trouvaille a une rotation validée, sinon lève. */
export async function assertRotationUnlocked(
  options: RitualOptions,
  findings: readonly Finding[],
): Promise<void> {
  for (const finding of findings) {
    const state = await loadState(options.placardDir, finding.fingerprint);
    if (state?.rotate === undefined) throw new PurgeLockedError(lockMessage(finding));
  }
}

interface CollectedReplacements {
  values: string[];
  warnings: string[];
}

/** Rassemble les valeurs à retirer : injectées, sinon relues dans le dépôt. */
async function collectReplacements(
  options: RitualOptions,
  findings: readonly Finding[],
  injected: ReadonlyMap<string, string> | undefined,
): Promise<CollectedReplacements> {
  const values: string[] = [];
  const warnings: string[] = [];
  for (const finding of findings) {
    const value = injected?.get(finding.fingerprint) ?? (await recoverValue(options.repoDir, finding))?.value;
    if (value === undefined || value.length === 0) {
      warnings.push(
        `No value could be recovered for finding ${finding.id} (rule ${finding.rule}): ` +
          'open the location by hand and add it to the replacements file before running the script.',
      );
      continue;
    }
    if (!values.includes(value)) values.push(value);
    if (value.includes('\n')) {
      warnings.push(
        `Finding ${finding.id} spans several lines: the replacement uses \\n escapes and needs ` +
          'git-filter-repo 2.38 or newer (the filter-branch fallback handles them too).',
      );
    }
  }
  return { values, warnings };
}

/** Vrai si `child` est hors de `parent` (comparaison sur chemins résolus). */
export function isOutside(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== '' && (rel.startsWith('..') || isAbsolute(rel));
}

function forcePushWarnings(): string[] {
  return [
    'Every commit from the first rewritten one gets a new identifier: branches, tags, ' +
      'releases and open pull requests must be updated by hand.',
    'Collaborators must re-clone: their existing clones still hold the old objects and ' +
      'will push them back on the next git push.',
    'Forks, pull request refs and the host cache keep the old history: ask the host to ' +
      'purge cached views, or contact support.',
    'CI caches, release tarballs, package registries and build artifacts built from the ' +
      'old history still contain the value: rebuild and republish them.',
    'Force-pushing rewrites shared history: announce the maintenance window before pushing.',
    'Placard did not run this script: review it, then run it on a mirror clone only.',
  ];
}

function buildCommands(options: RitualOptions, scriptPath: string, replacementsPath: string): string[] {
  const mirror = join(options.tmpDir, 'mirror.git');
  return [
    `git clone --mirror "${options.repoDir}" "${mirror}"`,
    `sh "${scriptPath}" "${mirror}"`,
    `git -C "${mirror}" log --all -p | grep -c "${REPLACEMENT_MARKER}" || true`,
    `git -C "${mirror}" push --force --all`,
    `git -C "${mirror}" push --force --tags`,
    `placard scan "${mirror}" --out placard-report.json`,
    `shred -u "${replacementsPath}"  # the replacements file holds the values`,
  ];
}

interface WrittenPaths {
  scriptPath: string;
  replacementsPath: string;
  helperPath: string;
}

async function writeFiles(
  options: RitualOptions,
  replacementsContent: string,
  scriptInput: { generatedAt: string },
): Promise<WrittenPaths> {
  const stamp = String(Date.now());
  await mkdir(options.tmpDir, { recursive: true, mode: 0o700 });
  const scriptsDir = join(options.placardDir, 'scripts');
  await mkdir(scriptsDir, { recursive: true });
  const replacementsPath = join(options.tmpDir, `placard-replacements-${stamp}.txt`);
  const helperPath = join(options.tmpDir, 'placard-filter-branch-helper.py');
  const scriptPath = join(scriptsDir, `purge-${stamp}.sh`);
  await writeFile(replacementsPath, replacementsContent, { mode: 0o600 });
  await chmod(replacementsPath, 0o600);
  await writeFile(helperPath, buildFallbackHelper(), { mode: 0o600 });
  await chmod(helperPath, 0o600);
  const script = buildPurgeScript({
    toolVersion: options.toolVersion,
    generatedAt: scriptInput.generatedAt,
    replacementsPath,
    helperPath,
  });
  await writeFile(scriptPath, script, { mode: 0o755 });
  await chmod(scriptPath, 0o755);
  return { scriptPath, replacementsPath, helperPath };
}

async function isSecureFile(path: string, repoDir: string): Promise<boolean> {
  try {
    const info = await stat(path);
    return (info.mode & 0o777) === 0o600 && isOutside(path, repoDir);
  } catch {
    return false;
  }
}

/**
 * Génère le script de purge et son fichier de remplacements.
 * `values` permet d'injecter les valeurs déjà connues du moteur ; sinon elles
 * sont relues dans le dépôt à l'emplacement de chaque trouvaille.
 */
export async function generatePurge(
  options: RitualOptions,
  findings: readonly Finding[],
  values?: ReadonlyMap<string, string>,
): Promise<PurgeArtifacts> {
  await assertRotationUnlocked(options, findings);
  const collected = await collectReplacements(options, findings, values);
  const generatedAt = new Date().toISOString();
  const written = await writeFiles(
    options,
    buildReplacementsFile(collected.values, generatedAt),
    { generatedAt },
  );
  const warnings = [...collected.warnings, ...forcePushWarnings()];
  if (collected.values.length === 0) {
    warnings.unshift('The replacements file is empty: this purge would rewrite nothing.');
  }
  return {
    scriptPath: written.scriptPath,
    replacementsPath: written.replacementsPath,
    secure: await isSecureFile(written.replacementsPath, options.repoDir),
    commands: buildCommands(options, written.scriptPath, written.replacementsPath),
    warnings,
  };
}
