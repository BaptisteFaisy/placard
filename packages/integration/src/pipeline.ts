import { resolve } from 'node:path';
import type {
  CommitEvent,
  HistoryEvent,
  PlacardReport,
  RawDetection,
  RepoSnapshot,
  SkippedFiles,
} from '@placard/core';
import { readHistory } from '@placard/git-history';
import { createDetectorEngine } from '@placard/detectors';
import { analyze } from '@placard/analysis';

export interface PipelineDetection {
  detection: RawDetection;
  commit: CommitEvent;
  path: string;
  lineNumber: number;
  context: string[];
}

export interface ScanPipelineResult {
  report: PlacardReport;
  rawValues: string[];
}

function fallbackSnapshot(): RepoSnapshot {
  return {
    name: 'local-repo',
    head: '0000000000000000000000000000000000000000',
    shortHead: '0000000',
    totalCommits: 0,
    branches: ['main'],
    tags: [],
    publicRemote: false,
    remotes: [],
  };
}

function handleLineEvent(
  ev: Extract<HistoryEvent, { kind: 'line' }>,
  detector: ReturnType<typeof createDetectorEngine>,
  commits: Map<string, CommitEvent>,
  detections: PipelineDetection[],
  rawValues: string[],
): void {
  const res = detector.scanLine({
    line: ev.line.text,
    path: ev.line.path,
    commit: ev.line.commit,
    lineNumber: ev.line.line,
    side: ev.line.side,
  });
  for (const det of res.detections) {
    rawValues.push(det.value);
    const cm = commits.get(ev.line.commit);
    if (!cm) continue;
    detections.push({
      detection: det,
      commit: cm,
      path: ev.line.path,
      lineNumber: ev.line.line,
      context: [ev.line.text],
    });
  }
}

/** Exécute le pipeline complet de bout en bout (git-history → detectors → analysis). */
export async function runScanPipeline(
  repoDir: string,
  salt = 'placard-integration-salt',
): Promise<ScanPipelineResult> {
  const detector = createDetectorEngine();
  const commits = new Map<string, CommitEvent>();
  const detections: PipelineDetection[] = [];
  const rawValues: string[] = [];
  const skipped: SkippedFiles = { binary: 0, tooLarge: 0 };
  let snapshot: RepoSnapshot | null = null;

  await readHistory({
    repoDir: resolve(repoDir),
    onEvent: (ev) => {
      if (ev.kind === 'repo') snapshot = ev.repo;
      if (ev.kind === 'commit') commits.set(ev.commit.commit, ev.commit);
      if (ev.kind === 'skipped') {
        if (ev.skipped.reason === 'binary') skipped.binary += 1;
        if (ev.skipped.reason === 'too_large') skipped.tooLarge += 1;
      }
      if (ev.kind === 'line') handleLineEvent(ev, detector, commits, detections, rawValues);
    },
  });

  const effective = snapshot ?? fallbackSnapshot();
  const analyzed = await analyze(
    {
      detections,
      skipped,
      repoMeta: {
        name: effective.name,
        head: effective.head,
        totalCommits: effective.totalCommits,
        publicRemote: effective.publicRemote,
        analyzedAt: new Date().toISOString(),
      },
      headPresence: new Map(),
    },
    { repo: effective, salt, toolVersion: '0.1.0' },
  );

  return { report: analyzed.report, rawValues };
}
