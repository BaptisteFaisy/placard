import { describe, expect, it } from 'vitest';

import { makeFinding, refOf } from './fixtures.js';
import { applyFilters, emptyFilter, matchesFilter, normalizeFilter } from './index.js';

const EARLY = refOf('early', '2021-02-01T10:00:00Z');
const LATE = refOf('late', '2024-02-01T10:00:00Z');

function corpus() {
  return [
    makeFinding({ id: 1, introduced: EARLY, danger: 92, family: 'cloud-key', state: 'open', inHead: true, path: 'src/aws/settings.ts' }),
    makeFinding({ id: 2, introduced: LATE, danger: 70, family: 'bank-data', state: 'sealed', inHead: false, path: 'app/payments.ts' }),
    makeFinding({ id: 3, introduced: LATE, danger: 20, family: 'identity', state: 'ignored', inHead: true, path: 'docs/people.md', rule: 'identity/email' }),
    makeFinding({ id: 4, introduced: EARLY, danger: 45, family: 'suspicious-string', state: 'rotated', inHead: false, path: 'lib/legacy.js' }),
  ];
}

const ids = (findings: { id: string }[]): string[] => findings.map((finding) => finding.id);

describe('filtres (PLA-F-19)', () => {
  it('ne retire rien sans critère', () => {
    const all = corpus();
    expect(applyFilters(all, emptyFilter())).toHaveLength(all.length);
  });

  it('filtre par gravité', () => {
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), severities: ['critical'] }))).toEqual(['sk_0001']);
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), severities: ['medium', 'low'] }))).toEqual([
      'sk_0003',
      'sk_0004',
    ]);
  });

  it('filtre par famille', () => {
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), families: ['identity'] }))).toEqual(['sk_0003']);
  });

  it('filtre par état', () => {
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), states: ['sealed', 'ignored'] }))).toEqual([
      'sk_0002',
      'sk_0003',
    ]);
  });

  it('filtre sur la présence dans HEAD', () => {
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), inHead: true }))).toEqual(['sk_0001', 'sk_0003']);
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), inHead: false }))).toEqual(['sk_0002', 'sk_0004']);
  });

  it('filtre sur une période d’années, bornes comprises', () => {
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), fromYear: 2024 }))).toEqual(['sk_0002', 'sk_0003']);
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), toYear: 2021 }))).toEqual(['sk_0001', 'sk_0004']);
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), fromYear: 2021, toYear: 2021 }))).toEqual([
      'sk_0001',
      'sk_0004',
    ]);
  });

  it('cherche dans l’aperçu, le chemin et la règle', () => {
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), query: 'payments' }))).toEqual(['sk_0002']);
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), query: 'identity/email' }))).toEqual(['sk_0003']);
    expect(ids(applyFilters(corpus(), { ...emptyFilter(), query: '[redacted:cloud-key]' }))).toEqual(['sk_0001']);
    expect(applyFilters(corpus(), { ...emptyFilter(), query: 'aucune-chance' })).toEqual([]);
  });

  it('combine les critères en ET', () => {
    const filter = { ...emptyFilter(), severities: ['high' as const], inHead: false };
    expect(ids(applyFilters(corpus(), filter))).toEqual(['sk_0002']);
  });

  it('normalise un filtre partiel et copie ses tableaux', () => {
    const source = { severities: ['critical' as const] };
    const normalized = normalizeFilter(source);
    expect(normalized.families).toEqual([]);
    expect(normalized.states).toEqual([]);
    expect(normalized.severities).not.toBe(source.severities);
    expect(matchesFilter(corpus()[0]!, normalized)).toBe(true);
  });
});
