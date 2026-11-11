/**
 * Contrat du lecteur d'historique Git (`@placard/git-history`).
 *
 * Le moteur lit l'historique en flux : il ne charge jamais un dépôt entier en
 * mémoire (PLA-N-04). Chaque commit produit un événement ; les lignes ajoutées
 * ET retirées sont lues (PLA-F-01), ce qui donne directement les commits
 * d'introduction et de retrait d'un secret.
 */

/** Une ligne de diff, déjà rattachée à son fichier et à son commit. */
export interface DiffLineEvent {
  /** SHA complet du commit qui porte cette ligne. */
  commit: string;
  /** Chemin du fichier dans l'arbre du commit. */
  path: string;
  /** Numéro de ligne dans la nouvelle version du fichier (1-based). */
  line: number;
  /** Contenu brut de la ligne, sans le préfixe `+` / `-`. */
  text: string;
  /** La ligne a-t-elle été ajoutée ou retirée par ce commit ? */
  side: 'added' | 'removed';
}

/** Métadonnées d'un commit, émises avant ses lignes de diff. */
export interface CommitEvent {
  commit: string;
  shortCommit: string;
  /** Date ISO 8601 (UTC) du commit auteur. */
  date: string;
  year: number;
  author: string;
  subject: string;
  /** Index du commit dans le parcours (0-based), pour la progression. */
  index: number;
}

/** Fichier ignoré par le lecteur, comptabilisé dans le rapport (PLA-F-01). */
export interface SkippedFileEvent {
  commit: string;
  path: string;
  reason: 'binary' | 'too_large';
  /** Taille en octets quand elle est connue. */
  bytes?: number;
}

/** Événements émis par le lecteur, dans l'ordre du parcours. */
export type HistoryEvent =
  | { kind: 'repo'; repo: RepoSnapshot }
  | { kind: 'commit'; commit: CommitEvent }
  | { kind: 'line'; line: DiffLineEvent }
  | { kind: 'skipped'; skipped: SkippedFileEvent }
  | { kind: 'progress'; scanned: number; total: number }
  | { kind: 'end'; commits: number; lines: number };

/** Photographie du dépôt au lancement de l'analyse. */
export interface RepoSnapshot {
  name: string;
  head: string;
  shortHead: string;
  totalCommits: number;
  branches: string[];
  tags: string[];
  /** Le dépôt a-t-il au moins un distant public (http/https non privé) ? */
  publicRemote: boolean;
  remotes: string[];
  firstCommitDate?: string;
  lastCommitDate?: string;
}

export interface ReadHistoryOptions {
  /** Chemin du dépôt Git (contient un `.git` ou est un dépôt nu). */
  repoDir: string;
  /** Références à parcourir. Par défaut : toutes (`--all`). */
  refs?: string[];
  /** Nombre maximal de commits à parcourir (0 = illimité). */
  maxCommits?: number;
  /** Taille maximale d'un fichier analysé, en octets (défaut 1 Mo). */
  maxFileBytes?: number;
  /** Motifs de chemins à ignorer (globs simples). */
  ignorePaths?: string[];
  /** Analyser seulement les modifications indexées (`placard scan --staged`). */
  stagedOnly?: boolean;
  /** Callback appelé pour chaque événement, dans l'ordre du parcours. */
  onEvent: (event: HistoryEvent) => void;
  /** Signal d'annulation. */
  signal?: AbortSignal;
}

/** Résultat synthétique du parcours. */
export interface ReadHistoryResult {
  repo: RepoSnapshot;
  commits: number;
  lines: number;
  skipped: { binary: number; tooLarge: number };
  /** Le parcours a-t-il été annulé avant la fin ? */
  aborted: boolean;
}

/**
 * Interface publique du paquet `@placard/git-history`.
 * Toute implémentation DOIT être déterministe à dépôt inchangé (PLA-P-05)
 * et DOIT survivre à un contenu hostile : octets nuls, lignes d'un mégaoctet,
 * séquences de contrôle (PLA-P-10, PLA-N-03).
 */
export interface HistoryReader {
  read(options: ReadHistoryOptions): Promise<ReadHistoryResult>;
}
