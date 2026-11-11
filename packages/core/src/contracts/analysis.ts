import type { PlacardReport, RepoMeta, SkippedFiles } from '../types.js';
import type { RawDetection } from './detector.js';
import type { CommitEvent, RepoSnapshot } from './git.js';

/**
 * Contrat du moteur d'analyse (`@placard/analysis`).
 *
 * L'analyse regroupe les détections par empreinte, reconstitue la durée de vie
 * de chaque secret (introduction, retraits, présence dans HEAD), calcule le
 * score de danger et applique les exclusions. Elle produit un rapport qui ne
 * contient AUCUNE valeur détectée (PLA-F-08, PLA-N-02).
 */

/** Une détection rattachée à son commit et à son emplacement. */
export interface AnchoredDetection {
  detection: RawDetection;
  commit: CommitEvent;
  path: string;
  lineNumber: number;
  /** Lignes de contexte déjà caviardées (jamais la valeur brute). */
  context: string[];
}

/** Progression émise pendant l'analyse, pour l'affichage temps réel (PLA-F-12). */
export type AnalysisProgress =
  | { kind: 'scanning'; commits: number; lines: number; findings: number }
  | { kind: 'grouping'; groups: number }
  | { kind: 'scoring'; done: number; total: number }
  | { kind: 'report'; findings: number };

export interface AnalyzeOptions {
  repo: RepoSnapshot;
  /** Sel propre au dépôt, utilisé pour les empreintes HMAC. */
  salt: string;
  /** Chemin du fichier d'exclusions `.placard/ignore.yml` (absent = aucune exclusion). */
  ignoreFile?: string;
  /** Règles personnalisées chargées depuis le dépôt (PLA-F-11). */
  customRulesPath?: string;
  /** Version de l'outil, écrite dans le rapport. */
  toolVersion: string;
  onProgress?: (progress: AnalysisProgress) => void;
}

/** Entrée du moteur : les détections ancrées, dans l'ordre du parcours. */
export interface AnalysisInput {
  detections: AnchoredDetection[];
  skipped: SkippedFiles;
  repoMeta: RepoMeta;
  /** SHA et contenu courant des fichiers de HEAD, pour décider `inHead`. */
  headPresence: ReadonlyMap<string, boolean>;
}

/** Résultat : le rapport, plus des compteurs de diagnostic (sans secret). */
export interface AnalysisResult {
  report: PlacardReport;
  /** Nombre de détections brutes avant regroupement. */
  rawDetections: number;
  /** Nombre de groupes (empreintes distinctes) obtenus. */
  groups: number;
  /** Durée de l'analyse en millisecondes. */
  durationMs: number;
}

/** Interface publique du paquet `@placard/analysis`. */
export interface AnalysisEngine {
  analyze(input: AnalysisInput, options: AnalyzeOptions): Promise<AnalysisResult>;
}

/** Contrat du paquet `@placard/analysis` — fonctions attendues. */
export interface AnalysisApi {
  analyze: AnalysisEngine['analyze'];
  /** Lit et applique `.placard/ignore.yml` ; retourne les empreintes écartées. */
  loadIgnoreFile(path: string | undefined): Promise<IgnoreMap>;
  /** Écrit une exclusion dans `.placard/ignore.yml` (PLA-F-29). */
  appendIgnoreEntry(path: string, entry: IgnoreFileEntry): Promise<void>;
}

/** Carte empreinte → raison d'exclusion. */
export type IgnoreMap = ReadonlyMap<string, IgnoreFileEntry>;

/** Entrée sérialisée dans `.placard/ignore.yml`. */
export interface IgnoreFileEntry {
  fingerprint: string;
  rule?: string;
  reason: string;
  author: string;
  /** Date ISO 8601. */
  date: string;
}
