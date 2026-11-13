import { resolve } from 'node:path';

import type {
  CommitEvent,
  DetectorInput,
  HistoryEvent,
  RawDetection,
  RepoSnapshot,
  ScanOptions,
  SkippedFiles,
} from '@placard/core';
import { readHistory } from '@placard/git-history';
import { createDetectorEngine, scanFile } from '@placard/detectors';

import type { PresenceInput } from './head-presence';

/**
 * Collecte des détections sur l'historique (PLA-F-01, PLA-F-02, PLA-F-04).
 *
 * Trois exigences que la lecture ligne à ligne ne suffit pas à couvrir :
 *  1. les **dates réelles** des commits — elles décident l'étage du manoir
 *     (une année = un étage) et la durée de vie d'un secret ;
 *  2. les constructions **multi-lignes** (bloc de clé privée) — elles demandent
 *     l'analyse par fichier (`scanFile`), pas ligne par ligne ;
 *  3. les fichiers à risque reconnus **par leur nom** (`scanPath`), qu'aucune
 *     ligne ne signale.
 *
 * Le parcours reste en flux : les lignes sont groupées par fichier le temps d'un
 * commit, puis le groupe est analysé et jeté.
 */

/** Une détection rattachée à son commit réel et à son emplacement. */
export interface AnchoredDetection {
  detection: RawDetection;
  commit: CommitEvent;
  path: string;
  lineNumber: number;
  context: string[];
}

/** Ce que produit la collecte, prêt pour le moteur d'analyse. */
export interface CollectOutcome {
  detections: AnchoredDetection[];
  skipped: SkippedFiles;
  snapshot: RepoSnapshot | null;
  /** Couples (chemin, valeur) pour décider la présence dans HEAD. */
  presenceInputs: PresenceInput[];
}

/** État mutable de la collecte d'un commit. */
interface CollectorState {
  detections: AnchoredDetection[];
  presenceInputs: PresenceInput[];
  skipped: SkippedFiles;
  snapshot: RepoSnapshot | null;
  commit: CommitEvent | undefined;
  groups: Map<string, DetectorInput[]>;
  /** Tous les chemins touchés par le commit courant, même sans ligne de diff. */
  paths: Set<string>;
}

function newState(): CollectorState {
  return {
    detections: [],
    presenceInputs: [],
    skipped: { binary: 0, tooLarge: 0 },
    snapshot: null,
    commit: undefined,
    groups: new Map(),
    paths: new Set(),
  };
}

/** Commit de repli quand le flux n'en fournit aucun (analyse des seules indexées). */
function stagedCommit(snapshot: RepoSnapshot | null): CommitEvent {
  const head = snapshot?.head ?? '0'.repeat(40);
  const now = new Date().toISOString();
  return {
    commit: head,
    shortCommit: head.slice(0, 7),
    date: now,
    year: new Date(now).getFullYear(),
    author: 'index',
    subject: 'staged changes',
    index: 0,
  };
}

/** Ajoute une détection ancrée, avec son couple (chemin, valeur) pour HEAD. */
function push(
  state: CollectorState,
  detection: RawDetection,
  path: string,
  lineNumber: number,
  context: string[],
): void {
  const commit = state.commit ?? stagedCommit(state.snapshot);
  state.detections.push({ detection, commit, path, lineNumber, context });
  state.presenceInputs.push({ path, value: detection.value });
}

/** Analyse un groupe de lignes d'un fichier : lignes, blocs, puis nom de fichier. */
function flushGroup(
  engine: ReturnType<typeof createDetectorEngine>,
  state: CollectorState,
  path: string,
  inputs: DetectorInput[],
): void {
  const scanned = scanFile(engine, inputs);
  scanned.results.forEach((result, index) => {
    const input = inputs[index];
    if (input === undefined) return;
    for (const detection of result.detections) {
      push(state, detection, path, input.lineNumber, [input.line]);
    }
  });
  for (const detection of scanned.fileDetections) {
    push(state, detection, path, 0, [path]);
  }
}

/** Fichiers sans aucune ligne de diff : les règles « par nom » seules s'appliquent. */
function flushEmptyPaths(
  engine: ReturnType<typeof createDetectorEngine>,
  state: CollectorState,
): void {
  for (const path of state.paths) {
    if (state.groups.has(path)) continue;
    for (const detection of engine.scanPath(path).detections) {
      push(state, detection, path, 0, [path]);
    }
  }
}

/** Vide tous les groupes du commit courant, puis les fichiers vides. */
function flushCommit(engine: ReturnType<typeof createDetectorEngine>, state: CollectorState): void {
  for (const [path, inputs] of state.groups) flushGroup(engine, state, path, inputs);
  flushEmptyPaths(engine, state);
  state.groups.clear();
  state.paths.clear();
}

/** Traite un événement du parcours d'historique. */
function handleEvent(
  engine: ReturnType<typeof createDetectorEngine>,
  state: CollectorState,
  ev: HistoryEvent,
): void {
  if (ev.kind === 'repo') {
    state.snapshot = ev.repo;
    return;
  }
  if (ev.kind === 'commit') {
    flushCommit(engine, state);
    state.commit = ev.commit;
    return;
  }
  if (ev.kind === 'file') {
    // PLA-F-04 : un fichier à risque se reconnaît aussi à son seul nom, y
    // compris quand il est vide (aucune ligne de diff à analyser).
    state.paths.add(ev.file.path);
    return;
  }
  if (ev.kind === 'skipped') {
    if (ev.skipped.reason === 'binary') state.skipped.binary += 1;
    if (ev.skipped.reason === 'too_large') state.skipped.tooLarge += 1;
    return;
  }
  if (ev.kind !== 'line') return;
  const inputs = state.groups.get(ev.line.path) ?? [];
  inputs.push({
    line: ev.line.text,
    path: ev.line.path,
    commit: ev.line.commit,
    lineNumber: ev.line.line,
    side: ev.line.side,
  });
  state.groups.set(ev.line.path, inputs);
}

/** Parcourt l'historique et rend les détections ancrées sur leurs commits réels. */
export async function collectHistory(options: ScanOptions): Promise<CollectOutcome> {
  const engine = createDetectorEngine();
  const state = newState();
  await readHistory({
    repoDir: resolve(options.repoDir),
    stagedOnly: options.staged,
    onEvent: (ev) => handleEvent(engine, state, ev),
  });
  flushCommit(engine, state);
  return {
    detections: state.detections,
    skipped: state.skipped,
    snapshot: state.snapshot,
    presenceInputs: state.presenceInputs,
  };
}
