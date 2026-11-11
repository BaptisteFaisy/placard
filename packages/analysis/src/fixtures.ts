import {
  fakeValue,
  sanitizeSnippet,
  type AnalysisInput,
  type AnalyzeOptions,
  type AnchoredDetection,
  type CommitEvent,
  type FindingFamily,
  type RawDetection,
  type RepoMeta,
  type RepoSnapshot,
  type SkippedFiles,
} from '@placard/core';

/**
 * Fabriques de test (support des suites `*.test.ts`).
 *
 * Aucune valeur au format réel d'un secret n'est écrite ici : les valeurs sont
 * fabriquées **à l'exécution** par `fakeValue` de `@placard/core`, à graine
 * fixe (règle PLA-N-09 du brief).
 */

/** Sel utilisé par les suites. */
export const TEST_SALT = 'placard-test-salt';

const DAY_MS = 86_400_000;
const BASE_DATE = Date.UTC(2026, 0, 1);

/** SHA synthétique déterministe (40 caractères hexadécimaux). */
export function shaFor(index: number): string {
  return (index + 1).toString(16).padStart(40, '0');
}

/** Date ISO déterministe : 1er janvier 2026 + `index` jours. */
export function dateFor(index: number): string {
  return new Date(BASE_DATE + index * DAY_MS).toISOString();
}

/** Commit synthétique, dans l'ordre du parcours. */
export function makeCommit(
  index: number,
  overrides: Partial<Omit<CommitEvent, 'index'>> = {},
): CommitEvent {
  const sha = shaFor(index);
  return {
    commit: sha,
    shortCommit: sha.slice(0, 7),
    date: dateFor(index),
    year: 2026,
    author: 'Test Author',
    subject: `commit ${index}`,
    index,
    ...overrides,
  };
}

/** Spécification d'une détection ancrée de test. */
export interface DetectionSpec {
  family: FindingFamily;
  /** Graine de la valeur factice (défaut : `'seed'`). */
  seed?: string;
  /** Rang de la valeur factice pour cette graine. */
  valueIndex?: number;
  commitIndex?: number;
  path?: string;
  line?: number;
  rule?: string;
  confidence?: number;
  /** Valeur imposée, au lieu d'une valeur factice. */
  value?: string;
  /** Contexte laissé brut (non caviardé) : prouve la défense en profondeur. */
  rawContext?: boolean;
}

/** Construit une `AnchoredDetection` en mémoire, sans dépôt Git réel. */
export function makeDetection(spec: DetectionSpec): AnchoredDetection {
  const commitIndex = spec.commitIndex ?? 0;
  const value = spec.value ?? fakeValue(spec.family, spec.seed ?? 'seed', spec.valueIndex ?? 0);
  const line = `const value = "${value}";`;
  const start = line.indexOf(value);
  const detection: RawDetection = {
    rule: spec.rule ?? `${spec.family}-rule`,
    family: spec.family,
    value,
    start: start < 0 ? 0 : start,
    end: start < 0 ? value.length : start + value.length,
    confidence: spec.confidence ?? 0.9,
  };
  const rawLine = `${line}\n// end of file`;
  return {
    detection,
    commit: makeCommit(commitIndex),
    path: spec.path ?? 'src/config.ts',
    lineNumber: spec.line ?? 12,
    context: [spec.rawContext === true ? rawLine : sanitizeSnippet(rawLine, value, spec.family)],
  };
}

/** Carte de présence dans HEAD à partir de chemins (ou de SHA) présents. */
export function presenceMap(...keys: string[]): ReadonlyMap<string, boolean> {
  return new Map(keys.map((key) => [key, true]));
}

/** Métadonnées de dépôt de test. */
export function makeRepoMeta(overrides: Partial<RepoMeta> = {}): RepoMeta {
  return {
    name: 'haunted-repo',
    head: shaFor(9),
    totalCommits: 10,
    publicRemote: false,
    analyzedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Photographie de dépôt de test, pour `AnalyzeOptions.repo`. */
export function makeRepoSnapshot(overrides: Partial<RepoSnapshot> = {}): RepoSnapshot {
  return {
    name: 'haunted-repo',
    head: shaFor(9),
    shortHead: shaFor(9).slice(0, 7),
    totalCommits: 10,
    branches: ['main'],
    tags: [],
    publicRemote: false,
    remotes: [],
    firstCommitDate: dateFor(0),
    lastCommitDate: dateFor(9),
    ...overrides,
  };
}

/** Entrée d'analyse de test. */
export function makeInput(
  detections: AnchoredDetection[],
  options: { headPresence?: ReadonlyMap<string, boolean>; repoMeta?: RepoMeta; skipped?: SkippedFiles } = {},
): AnalysisInput {
  return {
    detections,
    skipped: options.skipped ?? { binary: 0, tooLarge: 0 },
    repoMeta: options.repoMeta ?? makeRepoMeta(),
    headPresence: options.headPresence ?? new Map<string, boolean>(),
  };
}

/** Options d'analyse de test. */
export function makeOptions(overrides: Partial<AnalyzeOptions> = {}): AnalyzeOptions {
  return {
    repo: makeRepoSnapshot(),
    salt: TEST_SALT,
    toolVersion: '0.1.0-test',
    ...overrides,
  };
}
