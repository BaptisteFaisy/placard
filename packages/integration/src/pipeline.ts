import { basename, resolve } from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import type { PlacardReport } from '@placard/core';
import { parseReport, computeFingerprint } from '@placard/core';
import { scanCommand, repoSalt } from '@placard/cli';

/**
 * Pipeline de bout en bout : la **vraie** commande `placard scan`, pas une
 * recopie du moteur. C'est volontaire — une seconde implémentation du pipeline
 * finirait par diverger et les tests ne prouveraient plus rien sur le produit.
 */

export interface ScanPipelineResult {
  report: PlacardReport;
  /** Chemin du rapport écrit, pour les vérifications de non-divulgation. */
  reportPath: string;
  /** Sel utilisé par la CLI : permet de recalculer les empreintes attendues. */
  salt: string;
}

/** Analyse un dépôt avec la CLI réelle et relit le rapport produit. */
export async function runScanPipeline(repoDir: string): Promise<ScanPipelineResult> {
  const workDir = await mkdtemp(resolve(tmpdir(), 'placard-pipeline-'));
  const reportPath = resolve(workDir, 'report.json');
  try {
    const result = await scanCommand({ repoDir, report: reportPath, format: 'json' });
    if (result.exitCode !== 0 && result.errorCode !== 'open-findings') {
      throw new Error(`scan command failed: ${result.errorCode ?? 'unknown'}`);
    }
    const raw = await readFile(result.reportPath ?? reportPath, 'utf-8');
    // Même sel que la CLI : le nom du dépôt tel que Git le rapporte, et son
    // premier commit. Les empreintes attendues sont donc calculables par le
    // test sans jamais écrire une valeur.
    const salt = repoSalt(basename(resolve(repoDir)), resolve(repoDir));
    return { report: parseReport(JSON.parse(raw)), reportPath: result.reportPath ?? reportPath, salt };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/** Empreinte attendue d'une valeur plantée, pour comparer sans jamais l'écrire. */
export function expectedFingerprint(value: string, salt: string): string {
  return computeFingerprint(value, salt);
}
