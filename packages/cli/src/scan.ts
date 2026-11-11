import { resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import {
  type CliResult,
  type ScanOptions,
  type RepoSnapshot,
  type RawDetection,
  type SkippedFiles,
  stringifyReport,
} from '@placard/core';
import { readHistory } from '@placard/git-history';
import { createDetectorEngine } from '@placard/detectors';
import { analyze } from '@placard/analysis';
import { renderSummary } from './output.js';
import { repoSalt } from './salt.js';

/** Une détection ancrée, telle que l'exige le moteur d'analyse. */
interface AnchoredDetection {
  detection: RawDetection;
  commit: {
    commit: string;
    shortCommit: string;
    date: string;
    year: number;
    author: string;
    subject: string;
    index: number;
  };
  path: string;
  lineNumber: number;
  context: string[];
}

/** Ce que le parcours de l'historique produit, réduit à ce dont on a besoin. */
interface HistoryOutcome {
  detections: AnchoredDetection[];
  skipped: SkippedFiles;
  snapshot: RepoSnapshot | null;
}

/** Parcourt l'historique et applique les détecteurs ligne à ligne. */
async function collect(options: ScanOptions): Promise<HistoryOutcome> {
  const detector = createDetectorEngine();
  const detections: AnchoredDetection[] = [];
  const skipped: SkippedFiles = { binary: 0, tooLarge: 0 };
  let snapshot: RepoSnapshot | null = null;

  await readHistory({
    repoDir: resolve(options.repoDir),
    stagedOnly: options.staged,
    onEvent: (ev) => {
      if (ev.kind === 'repo') snapshot = ev.repo;
      if (ev.kind === 'skipped') {
        if (ev.skipped.reason === 'binary') skipped.binary += 1;
        if (ev.skipped.reason === 'too_large') skipped.tooLarge += 1;
      }
      if (ev.kind !== 'line') return;
      const found = detector.scanLine({
        line: ev.line.text,
        path: ev.line.path,
        commit: ev.line.commit,
        lineNumber: ev.line.line,
        side: ev.line.side,
      });
      for (const detection of found.detections) {
        detections.push(anchor(detection, ev.line.commit, ev.line.path, ev.line.line, ev.line.text));
      }
    },
  });

  return { detections, skipped, snapshot };
}

/** Rattache une détection à son commit et à son emplacement. */
function anchor(
  detection: RawDetection,
  commit: string,
  path: string,
  lineNumber: number,
  text: string,
): AnchoredDetection {
  const now = new Date().toISOString();
  return {
    detection,
    commit: {
      commit,
      shortCommit: commit.slice(0, 7),
      date: now,
      year: new Date(now).getFullYear(),
      author: 'committer',
      subject: 'commit',
      index: 0,
    },
    path,
    lineNumber,
    context: [text],
  };
}

/** Instantané de repli quand le dépôt n'a pas pu être décrit. */
function fallbackSnapshot(): RepoSnapshot {
  return {
    name: 'local-repo',
    head: '0000000000000000000000000000000000000000',
    shortHead: '0000000',
    totalCommits: 1,
    branches: ['main'],
    tags: [],
    publicRemote: false,
    remotes: [],
  };
}

/**
 * Commande `scan` (PLA-F-01, PLA-F-10, PLA-F-12, PLA-F-08).
 *
 * Le rapport et la sortie console ne contiennent que des aperçus masqués et des
 * empreintes : aucune valeur détectée ne quitte le moteur.
 */
export async function scanCommand(options: ScanOptions): Promise<CliResult> {
  const repoDir = resolve(options.repoDir);
  let outcome: HistoryOutcome;
  try {
    outcome = await collect(options);
  } catch (_error: unknown) {
    return { exitCode: 3, errorCode: 'not-a-git-repo' };
  }

  const snapshot = outcome.snapshot ?? fallbackSnapshot();
  // Sel propre au dépôt (cahier C.6) : stable dans le temps, différent d'un
  // dépôt à l'autre. Les empreintes restent donc comparables d'un scan à
  // l'autre — c'est ce qui rend le fichier d'exclusions utilisable.
  const salt = repoSalt(snapshot.name, repoDir);
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
      headPresence: new Map(),
    },
    { repo: snapshot, salt, toolVersion: '0.1.0' },
  );

  const reportPath = resolve(options.report ?? resolve(repoDir, '.placard/report.json'));
  await mkdir(resolve(reportPath, '..'), { recursive: true });
  await writeFile(reportPath, stringifyReport(analyzed.report), 'utf-8');

  if (options.format === 'json') {
    process.stdout.write(stringifyReport(analyzed.report) + '\n');
  } else {
    process.stdout.write(renderSummary(analyzed.report) + '\n');
  }

  const open = analyzed.report.findings.filter((finding) => finding.state === 'open');
  if (options.failOnOpen && open.length > 0) {
    return { exitCode: 1, errorCode: 'open-findings', reportPath };
  }
  return { exitCode: 0, reportPath };
}
