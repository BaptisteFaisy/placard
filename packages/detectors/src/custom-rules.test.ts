import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { compilePattern, isSafePatternSource, loadCustomRules, parseCustomRules } from './custom-rules.js';
import { createDetectorEngine } from './index.js';
import { inputOf } from './testing/fixtures.js';

/**
 * PLA-F-11 : règles personnalisées chargées depuis un fichier du dépôt.
 *
 * Le fichier vient du dépôt analysé : contenu **non fiable**, jamais exécuté
 * (PLA-N-03), validé champ par champ, et `loadCustomRules` ne lève jamais.
 */

let dir = '';

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'placard-rules-'));
});

afterAll(() => {
  dir = '';
});

/** Écrit un fichier de règles et le charge. */
async function loadFrom(content: string, name = 'rules.json'): Promise<ReturnType<typeof loadCustomRules>> {
  const path = join(dir, name);
  await writeFile(path, content, 'utf8');
  return loadCustomRules(path);
}

const VALID_RULE = {
  id: 'acme-internal-key',
  family: 'cloud-key',
  name: 'Acme internal key',
  keywords: ['acme'],
  pattern: 'acme_[a-z0-9]{12}',
  flags: 'i',
};

describe('custom rules loading (PLA-F-11)', () => {
  it('loads a valid rule file', async () => {
    const rules = await loadFrom(JSON.stringify({ rules: [VALID_RULE] }));
    expect(rules).toHaveLength(1);
    expect(rules[0]?.id).toBe('acme-internal-key');
    expect(rules[0]?.family).toBe('cloud-key');
    expect(rules[0]?.keywords).toEqual(['acme']);
  });

  it('accepts a bare array too', async () => {
    const rules = await loadFrom(JSON.stringify([VALID_RULE]), 'bare.json');
    expect(rules).toHaveLength(1);
  });

  it('returns an empty list for a missing file', async () => {
    await expect(loadCustomRules(join(dir, 'absent.json'))).resolves.toEqual([]);
  });

  it('returns an empty list for invalid JSON', async () => {
    await expect(loadFrom('{ not json', 'broken.json')).resolves.toEqual([]);
  });

  it('returns an empty list for an empty path', async () => {
    await expect(loadCustomRules('')).resolves.toEqual([]);
  });

  it('drops invalid entries but keeps the valid ones', () => {
    const rules = parseCustomRules({
      rules: [
        VALID_RULE,
        { id: 'Bad Id', family: 'cloud-key', name: 'x', pattern: 'a' },
        { id: 'unknown-family', family: 'nope', name: 'x', pattern: 'a' },
        { id: 'no-pattern', family: 'cloud-key', name: 'x' },
        { id: 'bad-regex', family: 'cloud-key', name: 'x', pattern: '([a-' },
        null,
        'nope',
        42,
      ],
    });
    expect(rules.map((rule) => rule.id)).toEqual(['acme-internal-key']);
  });

  it('rejects a catastrophic pattern', () => {
    const rules = parseCustomRules({
      rules: [{ ...VALID_RULE, id: 'boom', pattern: '(a+)+$' }],
    });
    expect(rules).toEqual([]);
    expect(isSafePatternSource('(a+)+$')).toBe(false);
    expect(isSafePatternSource('acme_[a-z0-9]{12}')).toBe(true);
  });

  it('drops duplicate ids', () => {
    const rules = parseCustomRules({ rules: [VALID_RULE, VALID_RULE] });
    expect(rules).toHaveLength(1);
  });

  it('never allows stateful or index flags', () => {
    const pattern = compilePattern('acme', 'gydim');
    expect(pattern).toBeDefined();
    expect(pattern?.flags).not.toContain('g');
    expect(pattern?.flags).not.toContain('y');
    expect(pattern?.flags).not.toContain('d');
    expect(pattern?.flags).toContain('i');
    expect(pattern?.flags).toContain('m');
  });

  it('refuses an over-long pattern', () => {
    expect(compilePattern('a'.repeat(2000), '')).toBeUndefined();
  });

  it('returns an empty list when the payload has no rules array', () => {
    expect(parseCustomRules({ other: true })).toEqual([]);
    expect(parseCustomRules(undefined)).toEqual([]);
  });
});

describe('custom rules in the engine', () => {
  it('detects with a custom rule loaded from disk', async () => {
    const rules = await loadFrom(JSON.stringify({ rules: [VALID_RULE] }), 'engine.json');
    const engine = createDetectorEngine({ customRules: rules });
    const detections = engine.scanLine(inputOf('internal = acme_a1b2c3d4e5f6')).detections;
    expect(detections.map((detection) => detection.rule)).toContain('acme-internal-key');
  });

  it('respects the keyword prefilter of a custom rule', async () => {
    const rules = await loadFrom(JSON.stringify({ rules: [VALID_RULE] }), 'engine2.json');
    const engine = createDetectorEngine({ customRules: rules });
    expect(engine.scanLine(inputOf('nothing acme-free here')).detections).toHaveLength(0);
  });

  it('exposes custom rules through rules()', async () => {
    const rules = await loadFrom(JSON.stringify({ rules: [VALID_RULE] }), 'engine3.json');
    const engine = createDetectorEngine({ customRules: rules });
    expect(engine.rules().some((rule) => rule.id === 'acme-internal-key')).toBe(true);
  });
});
