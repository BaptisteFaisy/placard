import type {
  CommitRef,
  Finding,
  FindingFamily,
  FindingState,
  PlacardReport,
  RepoMeta,
} from '@placard/core';

/**
 * Fabrique de rapports en mémoire pour les tests du modèle.
 *
 * Règle PLA-N-09 : **aucune valeur au format réel d'un secret n'est écrite dans
 * le dépôt**. Les aperçus sont des formes caviardées et les empreintes des
 * valeurs factices `hmac256:` + 32 hexadécimaux, dérivées d'une graine par un
 * hachage local — rien qui ressemble à un secret réel.
 */

/** Hachage FNV-1a étendu, purement déterministe, rendu en hexadécimal. */
function hashHex(seed: string, length: number): string {
  let state = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 0x01000193) >>> 0;
  }
  let out = '';
  while (out.length < length) {
    state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d) >>> 0;
    out += state.toString(16).padStart(8, '0');
  }
  return out.slice(0, length);
}

/** SHA factice de 40 hexadécimaux, dérivé d'une graine lisible. */
export function shaOf(seed: string): string {
  return hashHex(seed, 40);
}

/** Empreinte factice au format `hmac256:` + 32 hexadécimaux. */
export function fakeFingerprint(seed: string): string {
  return `hmac256:${hashHex(seed, 32)}`;
}

/** Aperçu caviardé, jamais une valeur. */
export function maskedPreview(family: FindingFamily): string {
  return `[REDACTED:${family}](24)`;
}

/** Référence de commit à partir d'une graine et d'une date ISO. */
export function refOf(seed: string, date: string): CommitRef {
  const commit = shaOf(seed);
  return { commit, shortCommit: commit.slice(0, 7), date, author: 'demo', message: `commit ${seed}` };
}

export interface FindingOptions {
  id?: number;
  family?: FindingFamily;
  rule?: string;
  danger?: number;
  inHead?: boolean;
  state?: FindingState;
  /** Graine de l'empreinte : deux trouvailles de même graine = même secret. */
  fingerprintSeed?: string;
  introduced: CommitRef;
  removed?: CommitRef[];
  /** Commits d'emplacement supplémentaires (présence du secret, sans retrait). */
  presentAt?: CommitRef[];
  path?: string;
}

/** Construit une trouvaille complète et cohérente pour les tests. */
export function makeFinding(options: FindingOptions): Finding {
  const id = options.id ?? 1;
  const family = options.family ?? 'cloud-key';
  const path = options.path ?? `src/config/settings-${id}.ts`;
  const locations = [
    { commit: options.introduced.commit, path, line: 12 },
    ...(options.presentAt ?? []).map((ref) => ({ commit: ref.commit, path, line: 12 })),
    ...(options.removed ?? []).map((ref) => ({ commit: ref.commit, path, line: 0 })),
  ];
  return {
    id: `sk_${String(id).padStart(4, '0')}`,
    family,
    rule: options.rule ?? `${family}/generic`,
    fingerprint: fakeFingerprint(options.fingerprintSeed ?? `secret-${id}`),
    preview: maskedPreview(family),
    danger: options.danger ?? 50,
    reasons: [],
    inHead: options.inHead ?? true,
    introduced: options.introduced,
    removed: options.removed ?? [],
    locations,
    state: options.state ?? 'open',
  };
}

export interface ReportOptions {
  name?: string;
  head?: string;
  totalCommits?: number;
  publicRemote?: boolean;
  analyzedAt?: string;
}

/** Construit un rapport conforme au schéma, sans aucune valeur détectée. */
export function makeReport(findings: Finding[], options: ReportOptions = {}): PlacardReport {
  const repo: RepoMeta = {
    name: options.name ?? 'haunted-demo',
    head: options.head ?? shaOf('head'),
    totalCommits: options.totalCommits ?? findings.length,
    publicRemote: options.publicRemote ?? false,
    analyzedAt: options.analyzedAt ?? '2024-06-01T00:00:00Z',
  };
  return {
    schema: '1.0.0',
    tool: { name: 'placard', version: '0.1.0' },
    repo,
    findings,
    skipped: { binary: 0, tooLarge: 0 },
  };
}

/** Instant de référence fixe : les âges et l'année du rez-de-chaussée sont déterministes. */
export const NOW = new Date('2024-06-01T00:00:00Z');
