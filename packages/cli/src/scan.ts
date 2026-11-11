import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';

import {
  type CliResult,
  type RepoSnapshot,
  type ScanOptions,
  stringifyReport,
} from '@placard/core';
import { analyze } from '@placard/analysis';

import { collectHistory, type CollectOutcome } from './collect.js';
import { buildHeadPresence } from './head-presence.js';
import { renderSummary } from './output.js';
import { repoSalt } from './salt.js';

/**
 * Commande `scan` (PLA-F-01, PLA-F-08, PLA-F-10, PLA-F-12).
 *
 * Chaîne : lecture de l'historique en flux → détecteurs → regroupement, durée de
 * vie et score → rapport validé par schéma. Le rapport et toute la sortie
 * console ne contiennent **aucune valeur détectée** : uniquement des aperçus
 * masqués, des empreintes HMAC et des extraits caviardés (PLA-N-02).
 */

/** Instantané de repli quand le dépôt n'a pas pu être décrit. */
function fallbackSnapshot(): RepoSnapshot {
  return {
    name: 'local-repo',
    head: '0'.repeat(40),
    shortHead: '0000000',
    totalCommits: 0,
    branches: ['main'],
    tags: [],
    publicRemote: false,
    remotes: [],
  };
}

/** Écrit le rapport, sans jamais y laisser une valeur détectée. */
async function writeReport(reportPath: string, report: Parameters<typeof stringifyReport>[0]): Promise<void> {
  await mkdir(resolve(reportPath, '..'), { recursive: true });
  await writeFile(reportPath, stringifyReport(report), 'utf-8');
}

/** Chemin du rapport : option `--report`, sinon `.placard/report.json` du dépôt. */
export function reportPathOf(options: ScanOptions, repoDir: string): string {
  return resolve(options.report ?? resolve(repoDir, '.placard/report.json'));
}

/** Analyse un dépôt et rend le résultat CLI (code de sortie, chemin du rapport). */
export async function scanCommand(options: ScanOptions): Promise<CliResult> {
  const repoDir = resolve(options.repoDir);
  let outcome: CollectOutcome;
  try {
    outcome = await collectHistory(options);
  } catch (_error: unknown) {
    return { exitCode: 3, errorCode: 'not-a-git-repo' };
  }

  const snapshot = outcome.snapshot ?? fallbackSnapshot();
  // Sel propre au dépôt (cahier C.6) : stable dans le temps — les exclusions
  // restent valables d'un scan à l'autre — et différent d'un dépôt à l'autre.
  const salt = repoSalt(snapshot.name, repoDir);
  const headPresence = await buildHeadPresence(repoDir, outcome.presenceInputs);

  const analyzed = await analyze(
    {
      detections: outcome.detections,
      skipped: outcome.skipped,
      repoMeta: {
        name: snapshot.name,
        head: snapshot.head,
        totalCommits: snapshot.totalCommits,
        publicRemote: snapshot.publicRemote,
        analyzedAt: new Date().toISOString(),
      },
      headPresence,
    },
    {
      repo: snapshot,
      salt,
      ignoreFile: resolve(repoDir, '.placard/ignore.yml'),
      toolVersion: '0.1.0',
    },
  );

  const reportPath = reportPathOf(options, repoDir);
  await writeReport(reportPath, analyzed.report);

  const text = options.format === 'json' ? stringifyReport(analyzed.report) : renderSummary(analyzed.report);
  process.stdout.write(`${text}\n`);

  const open = analyzed.report.findings.filter((finding) => finding.state === 'open');
  if (options.failOnOpen && open.length > 0) {
    return { exitCode: 1, errorCode: 'open-findings', reportPath };
  }
  return { exitCode: 0, reportPath };
}
