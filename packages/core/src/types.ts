/**
 * Familles de secrets et données sensibles prises en charge par Placard.
 */
export type FindingFamily =
  | 'cloud-key'
  | 'platform-token'
  | 'private-key'
  | 'signed-token'
  | 'plaintext-password'
  | 'bank-data'
  | 'identity'
  | 'risky-file'
  | 'suspicious-string';

/** Niveau de gravité associé à une trouvaille. */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

/** État du cycle de vie de la trouvaille dans le rituel. */
export type FindingState = 'open' | 'rotated' | 'purged' | 'sealed' | 'ignored';

/** Référence à un commit précis. */
export interface CommitRef {
  commit: string;
  shortCommit: string;
  date: string;
  author?: string;
  message?: string;
}

/** Emplacement précis d'une trouvaille dans l'arbre. */
export interface FindingLocation {
  commit: string;
  path: string;
  line: number;
  snippet?: string;
}

/** Modèle d'une trouvaille unique (dédupliquée par empreinte HMAC-SHA-256). */
export interface Finding {
  id: string;
  family: FindingFamily;
  rule: string;
  fingerprint: string;
  preview: string;
  danger: number;
  reasons: string[];
  inHead: boolean;
  introduced: CommitRef;
  removed: CommitRef[];
  locations: FindingLocation[];
  state: FindingState;
  ignoreReason?: string;
  rotatedAt?: string;
}

/** Décompte des fichiers ignorés lors de l'analyse. */
export interface SkippedFiles {
  binary: number;
  tooLarge: number;
}

/** Métadonnées du dépôt analysé. */
export interface RepoMeta {
  name: string;
  head: string;
  totalCommits: number;
  publicRemote: boolean;
  analyzedAt: string;
}

/** Structure complète du rapport d'analyse Placard (garanti SANS aucun secret). */
export interface PlacardReport {
  tool: {
    name: 'placard';
    version: string;
  };
  repo: RepoMeta;
  findings: Finding[];
  skipped: SkippedFiles;
}

/** Entrée dans le fichier d'exclusions .placard/ignore.yml */
export interface IgnoreEntry {
  fingerprint: string;
  rule?: string;
  reason: string;
  author: string;
  date: string;
}

/** Règle de détection interne. */
export interface DetectorRule {
  id: string;
  family: FindingFamily;
  name: string;
  baseScore: number;
  description: string;
  keywords: string[];
  pattern?: RegExp;
  validate?: (match: string, context?: string) => boolean;
}
