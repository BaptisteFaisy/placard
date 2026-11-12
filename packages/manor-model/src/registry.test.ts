import { describe, expect, it } from 'vitest';

import { NOW, makeFinding, makeReport, refOf } from './fixtures';
import { REGISTRY_SORT_FIELDS, buildRegistryRows, buildViewModel, emptyFilter } from './index';
import type { RegistrySortField } from '@placard/core';

const A = refOf('reg-a', '2021-06-01T10:00:00Z');
const B = refOf('reg-b', '2024-01-15T10:00:00Z');
const C = refOf('reg-c', '2022-09-09T10:00:00Z');

function corpus() {
  return makeReport([
    makeFinding({ id: 1, introduced: B, danger: 92, family: 'cloud-key', state: 'open', path: 'src/aws.ts' }),
    makeFinding({ id: 2, introduced: A, danger: 30, family: 'identity', state: 'sealed', path: 'docs/people.md' }),
    makeFinding({ id: 3, introduced: C, danger: 70, family: 'bank-data', state: 'ignored', path: 'app/pay.ts' }),
    makeFinding({ id: 4, introduced: A, danger: 45, family: 'cloud-key', state: 'rotated', path: 'src/aws.ts' }),
  ]);
}

const rowIds = (report = corpus(), field: RegistrySortField = 'danger', direction: 'asc' | 'desc' = 'asc') =>
  buildRegistryRows(buildViewModel(report, emptyFilter(), NOW), { field, direction }).map(
    (row) => row.finding.id,
  );

describe('registre (PLA-F-18)', () => {
  it('expose exactement les trouvailles du modèle', () => {
    const model = buildViewModel(corpus(), emptyFilter(), NOW);
    const rows = buildRegistryRows(model, { field: 'danger', direction: 'desc' });
    expect(rows).toHaveLength(model.findings.length);
    expect(rows.map((row) => row.finding.id).sort()).toEqual(model.findings.map((finding) => finding.id).sort());
  });

  it('trie par danger', () => {
    expect(rowIds(corpus(), 'danger', 'asc')).toEqual(['sk_0002', 'sk_0004', 'sk_0003', 'sk_0001']);
    expect(rowIds(corpus(), 'danger', 'desc')).toEqual(['sk_0001', 'sk_0003', 'sk_0004', 'sk_0002']);
  });

  it('trie par date d’introduction', () => {
    expect(rowIds(corpus(), 'date', 'asc')).toEqual(['sk_0002', 'sk_0004', 'sk_0003', 'sk_0001']);
    expect(rowIds(corpus(), 'date', 'desc')).toEqual(['sk_0001', 'sk_0003', 'sk_0002', 'sk_0004']);
  });

  it('trie par famille, chemin et état', () => {
    expect(rowIds(corpus(), 'family', 'asc')).toEqual(['sk_0003', 'sk_0001', 'sk_0004', 'sk_0002']);
    expect(rowIds(corpus(), 'path', 'asc')).toEqual(['sk_0003', 'sk_0002', 'sk_0001', 'sk_0004']);
    expect(rowIds(corpus(), 'state', 'asc')).toEqual(['sk_0003', 'sk_0001', 'sk_0004', 'sk_0002']);
  });

  it('reste déterministe quel que soit le sens du tri', () => {
    const report = corpus();
    const model = buildViewModel(report, emptyFilter(), NOW);
    const asc = buildRegistryRows(model, { field: 'path', direction: 'asc' }).map((row) => row.finding.id);
    const desc = buildRegistryRows(model, { field: 'path', direction: 'desc' }).map((row) => row.finding.id);
    expect(asc).not.toEqual(desc);
    expect([...asc].sort()).toEqual([...desc].sort());
    for (const field of REGISTRY_SORT_FIELDS) {
      const rows = buildRegistryRows(model, { field, direction: 'asc' });
      expect(rows).toHaveLength(model.findings.length);
    }
  });

  it('donne à chaque ligne une gravité, un chemin principal et un libellé complet', () => {
    const rows = buildRegistryRows(buildViewModel(corpus(), emptyFilter(), NOW), {
      field: 'danger',
      direction: 'desc',
    });
    const first = rows[0];
    expect(first?.severity).toBe('critical');
    expect(first?.path).toBe('src/aws.ts');
    for (const row of rows) {
      expect(row.ariaLabel.length).toBeGreaterThan(30);
      expect(row.ariaLabel).toContain('danger');
      expect(row.ariaLabel).toContain('path ');
      expect(row.ariaLabel).toContain('introduced');
      expect(row.path.length).toBeGreaterThan(0);
    }
  });
});
