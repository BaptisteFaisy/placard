import type { PlacardReport } from '../types';
import type { AnalysisProgress } from './analysis';
import type { HistoryEvent } from './git';

/**
 * Contrat de la ligne de commande (`@placard/cli`).
 *
 * Commandes : `scan`, `serve`, `ritual`, `demo`, `selftest` (cahier C.10).
 * Toute sortie texte est en anglais ; aucune valeur détectée n'y apparaît.
 */

export type CliCommandName = 'scan' | 'serve' | 'ritual' | 'demo' | 'selftest';

export interface ScanOptions {
  /** Chemin du dépôt à analyser (défaut : dossier courant). */
  repoDir: string;
  /** Chemin de sortie du rapport JSON (défaut : `.placard/report.json`). */
  report?: string;
  /** N'analyser que les modifications indexées (PLA-F-10). */
  staged?: boolean;
  /** Format de sortie console : `summary` (défaut) ou `json`. */
  format?: 'summary' | 'json';
  /** Code de retour non nul si une trouvaille ouverte existe. */
  failOnOpen?: boolean;
  /** Ouvrir le navigateur après l'analyse. */
  open?: boolean;
}

export interface ServeOptions {
  /** Rapport à servir (défaut : `.placard/report.json`). */
  report?: string;
  /** Port local (défaut : 4173, 0 = port libre). */
  port?: number;
  /** Ne pas ouvrir le navigateur. */
  noOpen?: boolean;
}

export interface DemoOptions {
  /** Dossier de destination du dépôt synthétique (défaut : `.placard/demo-repo`). */
  targetDir?: string;
  /** Graine (défaut : `placard-demo`). */
  seed?: string;
  /** Lancer l'analyse et le serveur local sur le dépôt synthétique. */
  serve?: boolean;
  port?: number;
}

export interface RitualCliOptions {
  repoDir: string;
  /** Sous-commande : `status`, `rotate`, `purge`, `prevent`, `verify`, `certificate`. */
  action: 'status' | 'rotate' | 'purge' | 'prevent' | 'verify' | 'certificate';
  /** Identifiant de trouvaille concernée (`sk_0007`). */
  finding?: string;
  /** Raison d'exclusion ou de non-application. */
  reason?: string;
}

/** Événements émis par la CLI pendant une analyse (progression, PLA-F-12). */
export type CliEvent =
  | { kind: 'history'; event: HistoryEvent }
  | { kind: 'analysis'; progress: AnalysisProgress }
  | { kind: 'report'; report: PlacardReport }
  | { kind: 'error'; message: string; code: CliErrorCode };

export type CliErrorCode =
  | 'not-a-git-repo'
  | 'git-missing'
  | 'filter-repo-missing'
  | 'report-missing'
  | 'report-invalid'
  | 'port-busy'
  | 'open-findings'
  | 'unknown';

export interface CliResult {
  /** Code de retour du processus. */
  exitCode: number;
  errorCode?: CliErrorCode;
  /** Chemin du rapport écrit, le cas échéant. */
  reportPath?: string;
  /** Adresse locale servie, le cas échéant. */
  url?: string;
}

/** Interface publique du paquet `@placard/cli`. */
export interface CliApi {
  scan(options: ScanOptions): Promise<CliResult>;
  serve(options: ServeOptions): Promise<CliResult>;
  demo(options: DemoOptions): Promise<CliResult>;
  ritual(options: RitualCliOptions): Promise<CliResult>;
  selftest(): Promise<CliResult>;
  /** Point d'entrée : découpe `argv`, exécute, retourne le code de sortie. */
  main(argv: readonly string[]): Promise<number>;
}
