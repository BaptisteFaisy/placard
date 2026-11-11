import type { FindingFamily } from '../types.js';

/**
 * Contrat du générateur de dépôt hanté (`@placard/demo-repo`).
 *
 * Le générateur fabrique, à partir d'une graine fixe, un dépôt synthétique
 * contenant des secrets factices de chaque famille, plantés à des dates et
 * durées variées (PLA-F-13). Il sert à la fois de démonstration et d'oracle
 * pour les tests par propriétés (PLA-P-02, PLA-P-03, PLA-P-06).
 *
 * Règle absolue (PLA-N-09) : aucune valeur factice au format réel n'est
 * écrite dans le dépôt de l'outil. Les valeurs sont fabriquées à l'exécution,
 * à partir de la graine, dans le dépôt synthétique temporaire.
 */

/** Une valeur plantée, connue du seul générateur (oracle de test). */
export interface PlantedSecret {
  /** Identifiant logique, ex. `aws-key-old`. */
  id: string;
  family: FindingFamily;
  /** Règle censée la détecter. */
  expectedRule: string;
  /** Valeur fabriquée — ne JAMAIS l'écrire dans le dépôt de l'outil. */
  value: string;
  /** Chemin relatif où elle est plantée. */
  path: string;
  /** Numéro de ligne dans le fichier au commit d'introduction. */
  line: number;
  /** SHA du commit d'introduction (renseigné après génération). */
  introducedCommit?: string;
  /** SHA du commit de retrait, si la valeur a été retirée. */
  removedCommit?: string;
  /** La valeur est-elle encore présente dans HEAD ? */
  inHead: boolean;
  /** Nombre d'emplacements où la valeur est plantée (PLA-P-06). */
  locations: number;
  /** Le chemin est-il un dossier de test ou d'exemple ? */
  testPath: boolean;
  /** Date ISO du commit d'introduction. */
  date: string;
}

export interface GenerateOptions {
  /** Graine deterministe (défaut : `placard-demo`). */
  seed?: string;
  /** Dossier de destination (créé s'il n'existe pas). */
  targetDir: string;
  /** Nombre de commits du dépôt synthétique (défaut 120). */
  commits?: number;
  /** Nombre d'années d'historique à simuler (défaut 4). */
  years?: number;
  /** Nombre de valeurs plantées (défaut 12, au moins une par famille). */
  secrets?: number;
  /** Date de référence du commit le plus récent (défaut : maintenant). */
  headDate?: Date;
  /** Ajouter un distant public fictif (pour le score +10). */
  publicRemote?: boolean;
}

export interface GenerateResult {
  repoDir: string;
  seed: string;
  commits: number;
  /** Oracle : les valeurs plantées, avec leurs commits réels. */
  planted: PlantedSecret[];
  head: string;
}

/** Interface publique du paquet `@placard/demo-repo`. */
export interface DemoRepoGenerator {
  generate(options: GenerateOptions): Promise<GenerateResult>;
  /** Fabrique une valeur factice d'une famille, à partir d'une graine. */
  fakeValue(family: FindingFamily, seed: string, index?: number): string;
}
