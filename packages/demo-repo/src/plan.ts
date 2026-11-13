import { fakeValue, prng, type FindingFamily, type Rand } from '@placard/core';

import { planNoise, type NoiseOp } from './noise';
import { expectedRuleFor } from './rules';
import { templateFor } from './templates';

/**
 * Plan de commits du dépôt hanté (PLA-F-13).
 *
 * Le plan est entièrement calculé **avant** la première commande Git : dates,
 * arcs de vie, emplacements, familles, messages et bruit. Rien ne dépend de
 * l'horloge pendant l'exécution, ce qui garantit que deux générations de même
 * graine et de même `headDate` produisent exactement les mêmes SHA.
 */

/** Les neuf familles de `@placard/core`, dans un ordre stable. */
export const FAMILIES: readonly FindingFamily[] = [
  'cloud-key',
  'platform-token',
  'private-key',
  'signed-token',
  'plaintext-password',
  'bank-data',
  'identity',
  'risky-file',
  'suspicious-string',
];

/** Arc de vie d'un secret planté. */
export type Arc = 'kept' | 'short' | 'months';

/** Un secret à planter, avec son arc de vie et ses emplacements. */
export interface PlannedSecret {
  /** Identifiant logique, unique dans une génération. */
  id: string;
  family: FindingFamily;
  /** Règle censée la détecter (provisoire, en attendant `@placard/detectors`). */
  expectedRule: string;
  /** Valeur fabriquée à l'exécution par `fakeValue`. */
  value: string;
  /** Nom de variable ou de clé employé dans le fichier hôte. */
  key: string;
  /** Chemins où la valeur est plantée (1 à 3, PLA-P-06). */
  paths: string[];
  /** Index du commit d'introduction. */
  introIndex: number;
  /** Index du commit de retrait, si la valeur a été retirée. */
  removeIndex?: number;
  /** La valeur est-elle plantée dans un dossier de test ou d'exemple ? */
  testPath: boolean;
  /** Vrai pour les familles qui se plantent par le nom du fichier (`risky-file`). */
  standalone: boolean;
}

/** Le plan complet d'une génération. */
export interface RepoPlan {
  seed: string;
  totalCommits: number;
  dates: Date[];
  messages: string[];
  secrets: PlannedSecret[];
  /** Bruit à appliquer, par index de commit. */
  noise: NoiseOp[][];
  /** Index du commit qui ajoute le fichier binaire. */
  binaryAt: number;
  /** Index du commit qui ajoute le fichier volumineux. */
  largeAt: number;
  publicRemote: boolean;
}

/** Options de planification (sous-ensemble de `GenerateOptions`). */
export interface PlanInput {
  seed: string;
  commits?: number;
  years?: number;
  secrets?: number;
  headDate?: Date;
  publicRemote?: boolean;
}

const PROD_PATHS: readonly string[] = [
  'src/config.ts',
  'src/services/storage.ts',
  'src/db/connection.ts',
  'src/legacy/billing.ts',
  'deploy/production.env',
  'config/settings.yml',
  'scripts/deploy.sh',
];

const TEST_PATHS: readonly string[] = [
  'tests/config.test.ts',
  'examples/quickstart.ts',
  'docs/setup.md',
];

const RISKY_DIRS_PROD: readonly string[] = ['deploy', 'config', ''];
const RISKY_DIRS_TEST: readonly string[] = ['examples', 'tests/fixtures', 'docs'];

const STEP_MS = 24 * 60 * 60 * 1000;

/** Dates de commit : réparties sur la fenêtre, strictement croissantes. */
function planDates(count: number, years: number, headDate: Date, rand: Rand): Date[] {
  const head = Math.floor(headDate.getTime() / 1000) * 1000;
  const span = Math.round(years * 365.25 * STEP_MS);
  const start = head - span;
  const step = count > 1 ? span / (count - 1) : 0;
  const dates: Date[] = [];
  let previous = start - 60_000;
  for (let index = 0; index < count; index += 1) {
    if (index === 0) {
      dates.push(new Date(start));
      previous = start;
      continue;
    }
    const base = index === count - 1 ? head : start + step * index;
    const jitter = index === count - 1 ? 0 : (rand() - 0.5) * step * 0.5;
    const raw = Math.min(head, Math.max(previous + 60_000, Math.round(base + jitter)));
    const stamp = Math.floor(raw / 1000) * 1000;
    dates.push(new Date(stamp));
    previous = stamp;
  }
  return dates;
}

function arcFor(index: number, rand: Rand): Arc {
  if (index === 0 || index === 3) return 'kept';
  if (index === 1) return 'short';
  if (index === 2) return 'months';
  const draw = rand();
  if (draw < 0.35) return 'short';
  if (draw < 0.55) return 'months';
  return 'kept';
}

function testPathFor(index: number, rand: Rand): boolean {
  if (index === 1 || index === 3) return true;
  return index > 3 && rand() < 0.25;
}

function locationsFor(index: number, rand: Rand): number {
  if (index === 0) return 3;
  return rand() < 0.2 ? 2 : 1;
}

function introFor(index: number, count: number, total: number, rand: Rand): number {
  const low = 1;
  const high = Math.max(1, total - 2);
  const step = (high - low + 1) / count;
  const jitter = index === 0 ? 0 : Math.round((rand() - 0.5) * 2);
  return Math.min(high, Math.max(low, low + Math.floor(index * step) + jitter));
}

function removeFor(arc: Arc, intro: number, total: number): number | undefined {
  if (arc === 'kept') return undefined;
  const distance = arc === 'short' ? 1 : Math.max(2, Math.round(total * 0.35));
  const target = Math.min(total - 1, intro + distance);
  return target > intro ? target : undefined;
}

/**
 * Nom de la clé hôte de la valeur plantée.
 *
 * Deux contraintes : le nom ne doit contenir **aucun mot-clé** d'une autre
 * famille (sinon une règle voisine revendique la valeur), et il doit porter le
 * contexte attendu par la règle de la famille — `key` pour la chaîne
 * suspecte, `password` pour le mot de passe.
 */
function keyFor(family: FindingFamily, value: string): string {
  switch (family) {
    case 'cloud-key':
      return 'AWS_ACCESS_KEY_ID';
    case 'platform-token':
      return 'DEPLOY_CREDENTIAL';
    case 'private-key':
      return 'DEPLOY_SIGNING_MATERIAL';
    case 'signed-token':
      return 'SESSION_JWT';
    case 'plaintext-password':
      return 'DB_PASSWORD';
    case 'bank-data':
      return value.startsWith('FR') ? 'SETTLEMENT_ACCOUNT' : 'CARD_REFERENCE';
    case 'identity':
      return value.includes('@') ? 'OWNER_EMAIL' : 'OWNER_SSN';
    case 'risky-file':
      return 'LOCAL_OVERRIDES';
    case 'suspicious-string':
      return 'LEGACY_API_KEY';
    default:
      return 'LEGACY_API_KEY';
  }
}

/**
 * Fichiers hôtes possibles d'une famille.
 *
 * Deux familles ont une contrainte de forme :
 *  - la **clé privée** n'est écrite que dans un `.ts` ou un `.env`, seuls
 *    dialectes où la valeur reste contiguë dans le fichier ;
 *  - la **chaîne suspecte** n'est écrite que dans un dialecte où elle est
 *    *isolée* sur sa ligne. Dans un `.env`, la règle qui la détecte capture
 *    `CLE=valeur` d'un seul tenant : la valeur rapportée par le moteur ne
 *    serait alors plus celle que l'oracle annonce.
 */
function pathPool(family: FindingFamily, testPath: boolean): string[] {
  const pool = testPath ? TEST_PATHS : PROD_PATHS;
  if (family === 'private-key') {
    const safe = pool.filter((path) => {
      const dialect = templateFor(path)?.dialect;
      return dialect === 'ts' || dialect === 'env';
    });
    return safe.length > 0 ? safe : [...pool];
  }
  if (family === 'suspicious-string') {
    const safe = pool.filter((path) => templateFor(path)?.dialect !== 'env');
    return safe.length > 0 ? safe : [...pool];
  }
  return [...pool];
}

/**
 * Choisit `count` chemins **de même dialecte**.
 *
 * Le dialecte conditionne la règle attendue (un mot de passe dans un `.env`
 * relève de la règle « environnement », le même mot de passe dans une constante
 * relève de la règle « affectation ») : une valeur plantée à plusieurs
 * emplacements doit donc porter la même règle partout.
 */
function pickPaths(
  pool: readonly string[],
  count: number,
  rand: Rand,
  uniformDialect: boolean,
): string[] {
  const available = [...pool];
  const chosen: string[] = [];
  while (chosen.length < count && available.length > 0) {
    const index = Math.min(available.length - 1, Math.floor(rand() * available.length));
    const [taken] = available.splice(index, 1);
    if (taken === undefined) continue;
    if (!uniformDialect) {
      chosen.push(taken);
      continue;
    }
    const dialect = templateFor(taken)?.dialect ?? 'ts';
    const already = chosen.map((path) => templateFor(path)?.dialect ?? 'ts');
    if (already.every((value) => value === dialect)) chosen.push(taken);
  }
  return chosen;
}

function riskyPaths(value: string, testPath: boolean, count: number): string[] {
  const dirs = testPath ? RISKY_DIRS_TEST : RISKY_DIRS_PROD;
  const paths: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const dir = dirs[index % dirs.length] ?? '';
    paths.push(dir === '' ? value : `${dir}/${value}`);
  }
  return paths;
}

function pathsFor(
  family: FindingFamily,
  value: string,
  testPath: boolean,
  locations: number,
  rand: Rand,
): string[] {
  if (family === 'risky-file') return riskyPaths(value, testPath, locations);
  // Le mot de passe change de règle selon le dialecte du fichier hôte : tous
  // ses emplacements doivent donc partager le même dialecte.
  const uniform = family === 'plaintext-password';
  const chosen = pickPaths(pathPool(family, testPath), locations, rand, uniform);
  const fallback = testPath ? TEST_PATHS[0] : PROD_PATHS[0];
  return chosen.length > 0 ? chosen : [fallback ?? 'src/config.ts'];
}

function planSecrets(seed: string, total: number, count: number, rand: Rand): PlannedSecret[] {
  const secrets: PlannedSecret[] = [];
  const perFamily = new Map<FindingFamily, number>();
  for (let index = 0; index < count; index += 1) {
    const family = FAMILIES[index % FAMILIES.length] ?? 'suspicious-string';
    const offset = perFamily.get(family) ?? 0;
    perFamily.set(family, offset + 1);
    const value = fakeValue(family, seed, offset);
    const arc = arcFor(index, rand);
    const testPath = testPathFor(index, rand);
    const introIndex = introFor(index, count, total, rand);
    const removeIndex = removeFor(arc, introIndex, total);
    const paths = pathsFor(family, value, testPath, locationsFor(index, rand), rand);
    const dialect = templateFor(paths[0] ?? '')?.dialect ?? 'ts';
    secrets.push({
      id: `${family}-${arc}-${index}`,
      family,
      expectedRule: expectedRuleFor(family, value, dialect),
      value,
      key: keyFor(family, value),
      paths,
      introIndex,
      removeIndex,
      testPath,
      standalone: family === 'risky-file',
    });
  }
  return secrets;
}

function planMessages(total: number, secrets: readonly PlannedSecret[], noise: NoiseOp[][]): string[] {
  const introductions = new Map<number, string>();
  const removals = new Map<number, string>();
  for (const secret of secrets) {
    if (!introductions.has(secret.introIndex)) introductions.set(secret.introIndex, secret.key);
    if (secret.removeIndex !== undefined && !removals.has(secret.removeIndex)) {
      removals.set(secret.removeIndex, secret.key);
    }
  }
  const messages: string[] = [];
  for (let index = 0; index < total; index += 1) {
    if (index === 0) {
      messages.push('chore: initial import');
      continue;
    }
    const removed = removals.get(index);
    if (removed !== undefined) {
      messages.push(`chore(config): drop legacy ${removed.toLowerCase()} wiring`);
      continue;
    }
    const introduced = introductions.get(index);
    if (introduced !== undefined) {
      messages.push(`feat(config): wire ${introduced.toLowerCase()} for the deploy pipeline`);
      continue;
    }
    messages.push(noise[index]?.[0]?.message ?? 'chore: tidy up');
  }
  return messages;
}

/** Construit le plan complet d'une génération à partir d'une graine fixe. */
export function buildPlan(input: PlanInput): RepoPlan {
  const rand = prng(input.seed);
  const totalCommits = Math.max(2, Math.floor(input.commits ?? 120));
  const years = input.years ?? 4;
  const headDate = input.headDate ?? new Date();
  const dates = planDates(totalCommits, years, headDate, rand);
  const secretCount = Math.max(Math.floor(input.secrets ?? 12), FAMILIES.length);
  const secrets = planSecrets(input.seed, totalCommits, secretCount, rand);
  const noise = planNoise(totalCommits, dates, rand);
  const messages = planMessages(totalCommits, secrets, noise);
  return {
    seed: input.seed,
    totalCommits,
    dates,
    messages,
    secrets,
    noise,
    binaryAt: Math.min(2, totalCommits - 1),
    largeAt: Math.min(5, totalCommits - 1),
    publicRemote: input.publicRemote === true,
  };
}
