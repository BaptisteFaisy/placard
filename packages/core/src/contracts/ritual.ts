import type { Finding } from '../types.js';

/**
 * Contrat du rituel de remédiation (`@placard/ritual`).
 *
 * Règle centrale (PLA-F-23, steering `remediation-order.md`) : l'ordre est
 * imposé. La purge reste verrouillée tant que la rotation n'est pas cochée
 * (ou déclarée sans objet avec une raison). L'outil n'exécute JAMAIS la purge
 * sur le dépôt de l'utilisateur (PLA-F-24).
 */

export type RitualStepId = 'rotate' | 'purge' | 'prevent' | 'verify';

export interface RitualStep {
  id: RitualStepId;
  /** Titre en anglais (interface et rapports en anglais). */
  title: string;
  /** Explication courte en anglais. */
  description: string;
  locked: boolean;
  /** Raison du verrou, affichée telle quelle (ex. « Rotate the secret first »). */
  lockReason?: string;
  done: boolean;
  /** Horodatage ISO de la réalisation, si faite. */
  doneAt?: string;
}

/** Fiche de rotation d'un fournisseur (PLA-F-22). */
export interface RotationCard {
  /** Identifiant de la règle ou du fournisseur, ex. `aws-access-key`. */
  provider: string;
  /** Nom affiché, ex. `Amazon Web Services`. */
  name: string;
  /** Où révoquer : intitulé de la page et chemin de navigation. */
  whereToRevoke: string;
  /** Lien officiel vers la documentation du fournisseur. */
  docUrl: string;
  /** Ce qu'il faut vérifier après révocation. */
  checklist: string[];
  /** La rotation est-elle sans objet (données personnelles) ? */
  notApplicable: boolean;
  /** Message légal prudent pour les données personnelles (sans conseil juridique). */
  notice?: string;
}

/** État persistant du rituel pour une trouvaille (dans `.placard/state/`). */
export interface RitualState {
  fingerprint: string;
  findingId: string;
  rotate?: { doneAt: string; by: string } | { notApplicable: true; reason: string; date: string };
  purge?: { scriptPath: string; generatedAt: string };
  prevent?: { appliedAt: string; items: string[] };
  verify?: { verifiedAt: string; reportPath: string; stillFound: boolean };
  sealedAt?: string;
}

export interface PurgeArtifacts {
  /** Chemin du script de purge (dans le dépôt, executable, sans secret). */
  scriptPath: string;
  /** Chemin du fichier de remplacements — HORS du dépôt, droits 0600. */
  replacementsPath: string;
  /** Le fichier de remplacements est-il hors du dépôt et en 0600 ? */
  secure: boolean;
  /** Commandes à relire par l'utilisateur, jamais exécutées par l'outil. */
  commands: string[];
  /** Avertissements sur le push forcé (identifiants changés, caches hébergeur…). */
  warnings: string[];
}

export interface RitualOptions {
  /** Dépôt analysé (jamais modifié par la purge). */
  repoDir: string;
  /** Dossier `.placard` du dépôt (état, exclusions, scripts). */
  placardDir: string;
  /** Dossier temporaire hors dépôt pour le fichier de remplacements. */
  tmpDir: string;
  /** Version de l'outil, écrite dans le certificat. */
  toolVersion: string;
}

/** Interface publique du paquet `@placard/ritual`. */
export interface RitualApi {
  /** Construit les 4 étapes avec leurs verrous pour une trouvaille. */
  steps(finding: Finding, state: RitualState | undefined): RitualStep[];
  /** Fiche de rotation de la règle ; repli sur une fiche générique. */
  rotationCard(rule: string, family: Finding['family']): RotationCard;
  /** Coche la rotation (ou la déclare sans objet avec raison). */
  markRotated(options: RitualOptions, finding: Finding, input: RotateInput): Promise<RitualState>;
  /** Génère le script de purge ; échoue si la rotation n'est pas faite. */
  generatePurge(options: RitualOptions, findings: Finding[]): Promise<PurgeArtifacts>;
  /** Propose les ajouts `.gitignore` + crochet pre-commit (PLA-F-26). */
  prevention(options: RitualOptions): Promise<PreventionProposal>;
  /** Scelle la trouvaille si la nouvelle analyse ne la retrouve plus (PLA-F-27). */
  verify(options: RitualOptions, finding: Finding, latestReportPath: string): Promise<RitualState>;
  /** Produit `PLACARD.md` et le badge SVG, sans aucun secret (PLA-F-28). */
  certificate(options: RitualOptions, input: CertificateInput): Promise<CertificateResult>;
  /** Lit/écrit l'état persistant du rituel. */
  loadState(placardDir: string, fingerprint: string): Promise<RitualState | undefined>;
  saveState(placardDir: string, state: RitualState): Promise<void>;
}

export type RotateInput =
  | { done: true; by: string }
  | { done: false; notApplicable: true; reason: string };

export interface PreventionProposal {
  /** Lignes à ajouter au `.gitignore`. */
  gitignoreLines: string[];
  /** Contenu du crochet pre-commit proposé. */
  preCommitHook: string;
  /** Chemin d'installation du crochet. */
  hookPath: string;
  /** Rappel d'activer la protection à l'envoi de l'hébergeur. */
  reminders: string[];
}

export interface CertificateInput {
  reportPath: string;
  treated: number;
  dismissed: number;
  open: number;
}

export interface CertificateResult {
  markdownPath: string;
  badgeSvgPath: string;
  markdown: string;
  badgeSvg: string;
}
