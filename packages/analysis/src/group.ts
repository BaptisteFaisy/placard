import {
  computeFingerprint,
  type AnchoredDetection,
  type FindingFamily,
  type FindingLocation,
} from '@placard/core';

/**
 * Regroupement des détections par empreinte HMAC (PLA-F-06).
 *
 * La même valeur trouvée à plusieurs endroits — plusieurs commits, plusieurs
 * fichiers, plusieurs lignes — donne **une seule** trouvaille portant tous ses
 * emplacements. La clé de regroupement est l'empreinte, jamais la valeur : le
 * moteur n'a donc pas besoin de comparer des secrets entre eux.
 */

/** Un groupe de détections partageant la même empreinte. */
export interface DetectionGroup {
  fingerprint: string;
  /** Valeur brute — **en mémoire uniquement**, jamais sérialisée. */
  value: string;
  family: FindingFamily;
  /** Règle retenue pour la trouvaille (la plus confiante du groupe). */
  rule: string;
  confidence: number;
  /** Détections du groupe, triées de façon déterministe. */
  detections: AnchoredDetection[];
}

/** Ordre canonique des détections : commit, puis fichier, puis ligne. */
export function compareDetections(a: AnchoredDetection, b: AnchoredDetection): number {
  if (a.commit.index !== b.commit.index) return a.commit.index - b.commit.index;
  if (a.commit.commit !== b.commit.commit) return a.commit.commit < b.commit.commit ? -1 : 1;
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
  const ruleA = a.detection.rule;
  const ruleB = b.detection.rule;
  return ruleA < ruleB ? -1 : ruleA > ruleB ? 1 : 0;
}

/** Copie triée d'une liste de détections, sans muter l'entrée. */
export function sortDetections(detections: readonly AnchoredDetection[]): AnchoredDetection[] {
  return [...detections].sort(compareDetections);
}

/**
 * Règle représentative du groupe : la confiance la plus haute, départagée par
 * l'identifiant de règle (ordre lexicographique) pour rester déterministe.
 */
function pickPrimary(sorted: readonly AnchoredDetection[]): AnchoredDetection {
  const first = sorted[0];
  if (first === undefined) throw new Error('pickPrimary: empty detection list');
  let best = first;
  for (const candidate of sorted) {
    if (candidate.detection.confidence > best.detection.confidence) {
      best = candidate;
    } else if (
      candidate.detection.confidence === best.detection.confidence &&
      candidate.detection.rule < best.detection.rule
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Empreinte HMAC d'une détection, avec le sel du dépôt. */
export function fingerprintOf(detection: AnchoredDetection, salt: string): string {
  return computeFingerprint(detection.detection.value, salt);
}

/**
 * Regroupe les détections par empreinte. Les groupes sortent triés par
 * empreinte, ce qui fixe l'ordre d'attribution des identifiants (PLA-P-05).
 */
export function groupDetections(
  detections: readonly AnchoredDetection[],
  salt: string,
): DetectionGroup[] {
  const buckets = new Map<string, AnchoredDetection[]>();
  for (const detection of detections) {
    const fingerprint = fingerprintOf(detection, salt);
    const bucket = buckets.get(fingerprint);
    if (bucket === undefined) buckets.set(fingerprint, [detection]);
    else bucket.push(detection);
  }

  const groups: DetectionGroup[] = [];
  for (const [fingerprint, bucket] of buckets) {
    const sorted = sortDetections(bucket);
    const primary = pickPrimary(sorted);
    groups.push({
      fingerprint,
      value: primary.detection.value,
      family: primary.detection.family,
      rule: primary.detection.rule,
      confidence: primary.detection.confidence,
      detections: sorted,
    });
  }

  return groups.sort((a, b) => (a.fingerprint < b.fingerprint ? -1 : a.fingerprint > b.fingerprint ? 1 : 0));
}

/**
 * Emplacements distincts d'un groupe (commit + fichier + ligne), dans l'ordre
 * canonique. `snippetFor` fournit l'extrait caviardé de chaque emplacement.
 */
export function locationsOf(
  group: DetectionGroup,
  snippetFor?: (detection: AnchoredDetection) => string | undefined,
): FindingLocation[] {
  const seen = new Set<string>();
  const locations: FindingLocation[] = [];
  for (const detection of group.detections) {
    const key = `${detection.commit.commit}\u0000${detection.path}\u0000${detection.lineNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const location: FindingLocation = {
      commit: detection.commit.commit,
      path: detection.path,
      line: Math.max(0, Math.trunc(detection.lineNumber)),
    };
    const snippet = snippetFor?.(detection);
    if (snippet !== undefined) location.snippet = snippet;
    locations.push(location);
  }
  return locations;
}
