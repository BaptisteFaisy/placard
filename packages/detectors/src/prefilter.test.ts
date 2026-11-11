import type { DetectorRule } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { createDetectorEngine } from './index.js';
import { compileKeywords, makePrefilter, prefilterMatches } from './prefilter.js';
import { RULE_IDS } from './registry.js';
import { fixture, inputOf } from './testing/fixtures.js';

/**
 * Préfiltre par mots-clés (cahier C.6) : une règle ancrée n'est **essayée** que
 * si l'un de ses mots-clés apparaît dans la ligne. Une règle structurelle
 * (`keywords` vide) est toujours essayée, sa forme étant son propre filtre.
 */

const engine = createDetectorEngine();

/** Règle de test, ancrée sur un mot-clé improbable. */
const anchoredRule: DetectorRule = {
  id: 'test-anchored',
  family: 'cloud-key',
  name: 'Test anchored rule',
  keywords: ['zzqx-marker'],
  pattern: /zzqx-marker-[a-z0-9]{4}/,
  priority: 200,
};

describe('keyword prefilter', () => {
  it('never tries an anchored rule when its keyword is absent', () => {
    const guarded = createDetectorEngine({ customRules: [anchoredRule] });
    const without = guarded.scanLine(inputOf('nothing relevant on this line'));
    const withMarker = guarded.scanLine(inputOf('zzqx-marker-ab12 here'));
    expect(without.detections).toHaveLength(0);
    expect(withMarker.detections.map((d) => d.rule)).toContain('test-anchored');
  });

  it('reports fewer tried rules on a line without any keyword', () => {
    const plain = engine.scanLine(inputOf('the quick brown fox'));
    const dense = engine.scanLine(inputOf(`token = ${fixture('platform-token', 'prefilter', 0)}`));
    expect(plain.rulesTried).toBeLessThan(dense.rulesTried);
  });

  it('tries structural rules even without a keyword', () => {
    // Aucune règle structurelle n'a de mot-clé : elles doivent rester essayées,
    // sinon un IBAN isolé passerait inaperçu.
    const structural = engine.rules().filter((rule) => rule.keywords.length === 0);
    expect(structural.length).toBeGreaterThan(0);
    expect(engine.scanLine(inputOf('nothing here')).rulesTried).toBeGreaterThanOrEqual(
      structural.length,
    );
  });

  it('matches keywords case-insensitively', () => {
    const prefiltre = makePrefilter(['PassWord']);
    expect(prefiltre('db_password = x')).toBe(true);
    expect(prefiltre('nothing')).toBe(false);
  });

  it('deduplicates and normalises keywords', () => {
    expect(compileKeywords(['A', 'a', 'b', ''])).toEqual(['a', 'b']);
  });

  it('treats an empty keyword list as always matching', () => {
    expect(prefilterMatches([], 'anything')).toBe(true);
  });

  it('is case-insensitive on the real rules', () => {
    const value = fixture('platform-token', 'prefilter', 0);
    const lower = engine.scanLine(inputOf(`token = ${value.toLowerCase()}`));
    const upper = engine.scanLine(inputOf(`token = ${value.toUpperCase()}`));
    expect(upper.rulesTried).toBeGreaterThanOrEqual(lower.rulesTried);
  });

  it('exposes the registry rules in descending priority order', () => {
    const priorities = engine.rules().map((rule) => rule.priority ?? 0);
    const sorted = [...priorities].sort((a, b) => b - a);
    expect(priorities).toEqual(sorted);
  });

  it('keeps every family represented in the registry', () => {
    const families = new Set(engine.rules().map((rule) => rule.family));
    expect(families).toEqual(
      new Set([
        'cloud-key',
        'platform-token',
        'private-key',
        'signed-token',
        'plaintext-password',
        'bank-data',
        'identity',
        'risky-file',
        'suspicious-string',
      ]),
    );
  });

  it('can disable a whole family', () => {
    const withoutIdentity = createDetectorEngine({ disabledFamilies: ['identity'] });
    const value = fixture('platform-token', 'disable', 0);
    expect(withoutIdentity.scanLine(inputOf(`token = ${value}`)).detections.length).toBeGreaterThan(0);
    expect(withoutIdentity.rules().some((rule) => rule.family === 'identity')).toBe(true);
    const email = fixture('identity', 'disable', 1);
    expect(withoutIdentity.scanLine(inputOf(`mail ${email}`)).detections).toHaveLength(0);
  });

  it('honours the entropy threshold option', () => {
    const strict = createDetectorEngine({ entropyThreshold: 5.9 });
    const value = fixture('suspicious-string', 'entropy', 0);
    const rules = strict.scanLine(inputOf(`api_key = ${value}`)).detections.map((d) => d.rule);
    expect(rules).not.toContain(RULE_IDS.suspiciousString);
  });
});
