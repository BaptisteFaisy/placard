import type { Finding, PlacardReport, SeverityLevel } from '../types.js';

/**
 * Contrat du modèle de présentation du manoir (`@placard/manor-model`).
 *
 * Ce modèle est l'unique source de vérité partagée par le manoir et le
 * registre : c'est ce qui garantit la propriété PLA-P-11 (pour tout jeu de
 * filtres, les deux vues exposent le même ensemble de trouvailles) et la
 * table de correspondance du costume (steering `costume-mapping.md`).
 */

/** Filtres communs aux deux vues (PLA-F-19). */
export interface FindingFilter {
  severities: SeverityLevel[];
  families: Finding['family'][];
  states: Finding['state'][];
  /** `true` = seulement les secrets encore dans HEAD, `false` = seulement absents, `undefined` = tous. */
  inHead?: boolean;
  /** Années incluses, bornes comprises. */
  fromYear?: number;
  toYear?: number;
  /** Recherche texte sur l'aperçu, le chemin ou la règle (sans valeur brute). */
  query?: string;
}

/** Un pan de mur : suite de commits sans trouvaille, compressée (C.4). */
export interface WallStretch {
  kind: 'wall';
  /** Nombre de commits compressés. */
  commits: number;
  year: number;
  /** Premier et dernier SHA de la suite, pour l'étiquette accessible. */
  fromCommit: string;
  toCommit: string;
}

/** Une porte : un commit qui contient au moins une trouvaille (C.4). */
export interface Door {
  kind: 'door';
  commit: string;
  shortCommit: string;
  date: string;
  year: number;
  /** Gravité maximale derrière la porte → lueur sous la porte. */
  severity: SeverityLevel;
  /** Âge en jours → toiles d'araignée. */
  ageDays: number;
  findings: Finding[];
  /** Trouvailles scellées (sceau de cire) et écartées (ruban) de cette porte. */
  sealed: number;
  dismissed: number;
  /** Libellé textuel complet pour les lecteurs d'écran (PLA-F-21). */
  ariaLabel: string;
}

export type CorridorItem = Door | WallStretch;

/** Un étage : une année d'historique. Le grenier est l'année la plus ancienne. */
export interface Floor {
  year: number;
  /** `true` pour l'année la plus ancienne (le grenier). */
  attic: boolean;
  /** `true` pour l'année en cours (le rez-de-chaussée). */
  ground: boolean;
  items: CorridorItem[];
  findings: number;
  severity: SeverityLevel | 'none';
}

/** Empreintes de pas osseuses : durée de vie d'un secret (C.4, PLA-F-17). */
export interface FootprintTrail {
  fingerprint: string;
  /** Portes reliées, dans l'ordre chronologique. */
  doors: { commit: string; year: number; role: 'introduced' | 'present' | 'removed' }[];
  lifetimeDays: number;
  /** Libellé accessible, ex. « lived 14 months across 11 doors on 2 floors ». */
  ariaLabel: string;
}

/** Synthèse du hall d'entrée (PLA-F-20). */
export interface HallSummary {
  total: number;
  standing: number;
  bySeverity: Record<SeverityLevel, number>;
  byFamily: Record<Finding['family'], number>;
  sealed: number;
  dismissed: number;
  open: number;
  /** Le dépôt a-t-il un distant public → fenêtre ouverte dans le couloir. */
  publicRemote: boolean;
}

/** Modèle complet prêt à rendre. */
export interface ManorViewModel {
  /** Étages, du grenier (index 0) au rez-de-chaussée. */
  floors: Floor[];
  hall: HallSummary;
  filter: FindingFilter;
  /** Trouvailles retenues par le filtre — le registre affiche exactement cet ensemble. */
  findings: Finding[];
  repo: PlacardReport['repo'];
  /** Portes totales et murs compressés, pour la légende et les performances. */
  doorCount: number;
  wallCount: number;
}

/** Interface publique du paquet `@placard/manor-model`. */
export interface ManorModelApi {
  /** Construit le modèle depuis un rapport et un filtre. Pur et déterministe. */
  buildViewModel(report: PlacardReport, filter: FindingFilter, now?: Date): ManorViewModel;
  /** Applique un filtre à une liste de trouvailles (une seule implémentation). */
  applyFilters(findings: readonly Finding[], filter: FindingFilter): Finding[];
  /** Construit les empreintes de pas d'une trouvaille sélectionnée. */
  footprints(report: PlacardReport, finding: Finding): FootprintTrail;
  /** Gravité déduite du score de danger (seuils documentés). */
  severityOf(danger: number): SeverityLevel;
  /** Filtre vide (aucun critère). */
  emptyFilter(): FindingFilter;
  /** Lignes du registre, triées — exactement le même ensemble que le manoir. */
  registryRows(model: ManorViewModel, sort: RegistrySort): RegistryRow[];
}

export type RegistrySortField = 'danger' | 'date' | 'family' | 'path' | 'state';

export interface RegistrySort {
  field: RegistrySortField;
  direction: 'asc' | 'desc';
}

/** Une ligne du registre : les mêmes données qu'une fiche du manoir. */
export interface RegistryRow {
  finding: Finding;
  severity: SeverityLevel;
  /** Chemin principal (premier emplacement). */
  path: string;
  /** Libellé accessible de la ligne. */
  ariaLabel: string;
}
