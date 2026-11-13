import type { FindingFamily } from '../types';

/**
 * Contrat des détecteurs (`@placard/detectors`).
 *
 * Chaîne de traitement (cahier des charges C.6) :
 *   préfiltre par mots-clés → règles par famille → validations → détection.
 * Une règle n'est essayée que si l'un de ses mots-clés apparaît dans la ligne,
 * ce qui borne le coût sur un gros dépôt.
 */

/** Une occurrence brute trouvée dans une ligne. La valeur NE SORT JAMAIS du moteur. */
export interface RawDetection {
  rule: string;
  family: FindingFamily;
  /** Valeur détectée — uniquement en mémoire, jamais sérialisée ni journalisée. */
  value: string;
  /** Indice de début de la valeur dans la ligne. */
  start: number;
  /** Indice de fin (exclusif) de la valeur dans la ligne. */
  end: number;
  /** Confiance de la règle entre 0 et 1, utilisée pour départager deux règles. */
  confidence: number;
}

/** Contexte fourni à une règle pour ses validations (entropie, voisinage). */
export interface DetectorInput {
  /** Ligne brute, telle que lue dans le diff. */
  line: string;
  /** Chemin du fichier, pour les règles de type « fichier à risque ». */
  path: string;
  /** SHA du commit porteur. */
  commit: string;
  /** Numéro de ligne (1-based). */
  lineNumber: number;
  /** Ligne ajoutée ou retirée par ce commit. */
  side: 'added' | 'removed';
}

/** Une règle de détection : préfiltre, motif, validations, score de base. */
export interface DetectorRule {
  /** Identifiant stable, en kebab-case, repris dans le rapport (`rule`). */
  id: string;
  family: FindingFamily;
  /** Nom lisible, en anglais (interface et rapports sont en anglais). */
  name: string;
  /** Mots-clés du préfiltre : la règle n'est essayée que si l'un d'eux est présent. */
  keywords: string[];
  /** Motif principal. Doit être borné (pas de backtracking catastrophique). */
  pattern: RegExp;
  /** Validations supplémentaires : somme de contrôle, entropie, contexte. */
  validate?: (value: string, input: DetectorInput) => boolean;
  /** Ajustement du score de base de la famille (par défaut 0). */
  scoreAdjust?: number;
  /** Priorité : la règle la plus prioritaire gagne quand deux règles se chevauchent. */
  priority?: number;
  /** Le fournisseur associé, pour la fiche de rotation du rituel. */
  provider?: string;
}

/** Résultat d'un détecteur pour une ligne. */
export interface DetectorResult {
  detections: RawDetection[];
  /** Règles essayées, pour les métriques de performance (jamais dans le rapport). */
  rulesTried: number;
}

/** Interface publique du paquet `@placard/detectors`. */
export interface DetectorEngine {
  /** Toutes les règles actives, dans l'ordre d'application. */
  rules(): readonly DetectorRule[];
  /** Analyse une ligne ; ne lève jamais d'exception sur un contenu hostile (PLA-P-10). */
  scanLine(input: DetectorInput): DetectorResult;
  /** Signale les fichiers à risque par leur seul nom (PLA-F-04). */
  scanPath(path: string): DetectorResult;
}

/** Options de construction du moteur de détection. */
export interface DetectorEngineOptions {
  /** Règles personnalisées ajoutées par l'utilisateur (PLA-F-11). */
  customRules?: DetectorRule[];
  /** Familles à désactiver. */
  disabledFamilies?: FindingFamily[];
  /** Seuil d'entropie de Shannon pour les chaînes suspectes (défaut 3.5). */
  entropyThreshold?: number;
}
