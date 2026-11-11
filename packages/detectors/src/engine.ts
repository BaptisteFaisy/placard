import type {
  DetectorEngine,
  DetectorEngineOptions,
  DetectorInput,
  DetectorResult,
  DetectorRule,
  FindingFamily,
  RawDetection,
} from '@placard/core';

import { resolveOverlaps } from './overlap.js';
import { compileKeywords, prefilterMatches } from './prefilter.js';
import { builtinRuleSet, priorityOf, sortByPriority } from './registry.js';

/**
 * Moteur de détection : implémentation de `DetectorEngine`.
 *
 * Chaîne imposée (cahier C.6) :
 *   préfiltre par mots-clés → règles par famille → validations → détection,
 * puis résolution des chevauchements par priorité.
 *
 * Le moteur **ne lève jamais** (PLA-P-10) et ne divulgue jamais une valeur
 * (PLA-N-02) : la valeur détectée reste dans `RawDetection.value`, à destination
 * de l'empreinte HMAC du lot `analysis`, jamais d'un journal ou d'une erreur.
 */

/** Nombre maximal d'occurrences retenues par règle et par ligne. */
const MAX_MATCHES_PER_RULE = 64;

/** Règle compilée : motif global, mots-clés normalisés, priorité. */
interface CompiledRule {
  rule: DetectorRule;
  pattern: RegExp;
  keywords: readonly string[];
  priority: number;
  confidence: number;
}

/** Moteur interne : règles compilées et état partagé par les trois méthodes. */
interface CompiledEngine {
  lineRules: readonly CompiledRule[];
  pathRules: readonly CompiledRule[];
  priorities: ReadonlyMap<string, number>;
  exposed: readonly DetectorRule[];
  disabled: ReadonlySet<FindingFamily>;
}

/**
 * Confiance dérivée de la priorité : une règle plus spécifique est plus
 * prioritaire **et** plus sûre d'elle. Utilisée pour départager deux règles de
 * même priorité dans `resolveOverlaps`.
 */
function confidenceFor(priority: number): number {
  return Math.max(0.05, Math.min(0.99, 0.5 + priority / 200));
}

/** Version globale (et indexée) d'un motif, pour énumérer toutes les occurrences. */
function toGlobal(pattern: RegExp): RegExp {
  const flags = new Set(pattern.flags.split('').filter((flag) => !'gyd'.includes(flag)));
  flags.add('g');
  flags.add('d');
  return new RegExp(pattern.source, [...flags].join(''));
}

/** Compile une règle ; `undefined` si son motif n'est pas un `RegExp` utilisable. */
function compileRule(rule: DetectorRule): CompiledRule | undefined {
  if (!(rule.pattern instanceof RegExp)) return undefined;
  if (typeof rule.id !== 'string' || rule.id.length === 0) return undefined;
  const priority = priorityOf(rule);
  return {
    rule,
    pattern: toGlobal(rule.pattern),
    keywords: compileKeywords(Array.isArray(rule.keywords) ? rule.keywords : []),
    priority,
    confidence: confidenceFor(priority),
  };
}

/** Compile une liste de règles en écartant celles qui ne sont pas exploitables. */
function compileRules(rules: readonly DetectorRule[]): CompiledRule[] {
  return rules
    .map(compileRule)
    .filter((compiled): compiled is CompiledRule => compiled !== undefined);
}

/** Bornes de la valeur retenue : groupe 1 s'il participe, sinon l'occurrence entière. */
function spanOf(
  match: RegExpExecArray,
  useGroup: boolean,
): { start: number; end: number; value: string } {
  const whole = match[0] ?? '';
  const group = match[1];
  if (useGroup && group !== undefined && group.length > 0) {
    const indices = match.indices?.[1];
    if (indices !== undefined) return { start: indices[0], end: indices[1], value: group };
  }
  const wholeIndices = match.indices?.[0];
  const start = wholeIndices?.[0] ?? match.index;
  const end = wholeIndices?.[1] ?? match.index + whole.length;
  return { start, end, value: whole };
}

/** La règle accepte-t-elle la valeur ? Une validation qui lève vaut refus. */
function isAccepted(rule: DetectorRule, value: string, input: DetectorInput): boolean {
  if (rule.validate === undefined) return true;
  try {
    return rule.validate(value, input) === true;
  } catch {
    return false;
  }
}

/** Énumère les occurrences d'une règle sur un texte et alimente `out`. */
function collectRule(
  compiled: CompiledRule,
  text: string,
  input: DetectorInput,
  out: RawDetection[],
): void {
  const { pattern, rule } = compiled;
  pattern.lastIndex = 0;
  let match = pattern.exec(text);
  let seen = 0;
  while (match !== null && seen < MAX_MATCHES_PER_RULE) {
    const hasGroup = match[1] !== undefined && match[1].length > 0;
    const { start, end, value } = spanOf(match, hasGroup);
    if (end > start && value.length > 0 && isAccepted(rule, value, input)) {
      out.push({
        rule: rule.id,
        family: rule.family,
        value,
        start,
        end,
        confidence: compiled.confidence,
      });
    }
    seen += 1;
    if ((match[0] ?? '').length === 0) pattern.lastIndex += 1;
    match = pattern.exec(text);
  }
}

/** Carte identifiant de règle → priorité, pour la résolution des chevauchements. */
function buildPriorities(rules: readonly CompiledRule[]): Map<string, number> {
  const priorities = new Map<string, number>();
  for (const compiled of rules) priorities.set(compiled.rule.id, compiled.priority);
  return priorities;
}

/** Lit la ligne d'une entrée, même si l'appelant a fourni autre chose qu'une chaîne. */
function lineOf(input: DetectorInput): string {
  const line: unknown = input?.line;
  return typeof line === 'string' ? line : '';
}

/** Lit le chemin d'une entrée, même si l'appelant a fourni autre chose qu'une chaîne. */
function pathOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Exécute un lot de règles compilées sur un texte, sans jamais lever. */
function runRules(
  rules: readonly CompiledRule[],
  text: string,
  haystack: string,
  input: DetectorInput,
  disabled: ReadonlySet<FindingFamily>,
): DetectorResult {
  const detections: RawDetection[] = [];
  let rulesTried = 0;
  for (const compiled of rules) {
    if (disabled.has(compiled.rule.family)) continue;
    if (!prefilterMatches(compiled.keywords, haystack)) continue;
    rulesTried += 1;
    try {
      collectRule(compiled, text, input, detections);
    } catch {
      // Contenu hostile : la règle est abandonnée, la ligne continue d'être lue.
    }
  }
  return { detections, rulesTried };
}

/** Assemble les règles compilées et les priorités à partir des options. */
function compileEngine(options: DetectorEngineOptions): CompiledEngine {
  const ruleSet = builtinRuleSet(
    options.entropyThreshold === undefined ? {} : { entropyThreshold: options.entropyThreshold },
  );
  const custom = Array.isArray(options.customRules) ? options.customRules : [];
  const lineRules = compileRules(sortByPriority([...ruleSet.lineRules, ...custom]));
  const pathRules = compileRules(ruleSet.pathRules);
  return {
    lineRules,
    pathRules,
    priorities: buildPriorities([...lineRules, ...pathRules]),
    exposed: sortByPriority([...lineRules.map((c) => c.rule), ...pathRules.map((c) => c.rule)]),
    disabled: new Set<FindingFamily>(
      Array.isArray(options.disabledFamilies) ? options.disabledFamilies : [],
    ),
  };
}

/** Analyse une ligne avec les règles compilées ; ne lève jamais. */
function scanLineWith(engine: CompiledEngine, input: DetectorInput): DetectorResult {
  try {
    const line = lineOf(input);
    const result = runRules(engine.lineRules, line, line.toLowerCase(), input, engine.disabled);
    return {
      detections: resolveOverlaps(result.detections, engine.priorities),
      rulesTried: result.rulesTried,
    };
  } catch {
    return { detections: [], rulesTried: 0 };
  }
}

/** Analyse un chemin avec les règles de chemin ; ne lève jamais. */
function scanPathWith(engine: CompiledEngine, path: string): DetectorResult {
  try {
    const value = pathOf(path);
    if (value.length === 0) return { detections: [], rulesTried: 0 };
    const input: DetectorInput = {
      line: value,
      path: value,
      commit: '',
      lineNumber: 0,
      side: 'added',
    };
    const result = runRules(engine.pathRules, value, value.toLowerCase(), input, engine.disabled);
    // La valeur d'une trouvaille « fichier à risque » est le chemin entier : deux
    // fichiers différents ne doivent jamais partager la même empreinte.
    const detections = result.detections.map((detection) => ({
      ...detection,
      value,
      start: 0,
      end: value.length,
    }));
    return {
      detections: resolveOverlaps(detections, engine.priorities),
      rulesTried: result.rulesTried,
    };
  } catch {
    return { detections: [], rulesTried: 0 };
  }
}

/** Construit le moteur de détection (contrat `DetectorEngine`). */
export function createDetectorEngine(options: DetectorEngineOptions = {}): DetectorEngine {
  const engine = compileEngine(options);
  return {
    rules(): readonly DetectorRule[] {
      return engine.exposed;
    },
    scanLine: (input: DetectorInput): DetectorResult => scanLineWith(engine, input),
    scanPath: (path: string): DetectorResult => scanPathWith(engine, path),
  };
}
