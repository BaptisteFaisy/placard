import { parseReport } from '@placard/core';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { CorridorItem, FindingFilter, PlacardReport } from '@placard/core';

import { NOW, makeFinding, makeReport, refOf, shaOf } from './fixtures';
import {
  applyFilters,
  buildRegistryRows,
  buildViewModel,
  emptyFilter,
  matchesFilter,
  REGISTRY_SORT_FIELDS,
} from './index';

/**
 * Propriétés fast-check du modèle de présentation.
 *
 * - **PLA-P-11** : pour tout jeu de filtres, `buildViewModel(...).findings` et
 *   `registryRows(...)` exposent exactement le même ensemble de trouvailles.
 * - **PLA-P-12** : ajouter un commit sans secret ne change aucune trouvaille
 *   existante (seuls les pans de mur peuvent bouger).
 */

const FAMILIES = [
  'cloud-key',
  'platform-token',
  'private-key',
  'signed-token',
  'plaintext-password',
  'bank-data',
  'identity',
  'risky-file',
  'suspicious-string',
] as const;
const STATES = ['open', 'rotated', 'purged', 'sealed', 'ignored'] as const;
const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

const specArb = fc.record({
  family: fc.constantFrom(...FAMILIES),
  danger: fc.integer({ min: 0, max: 100 }),
  state: fc.constantFrom(...STATES),
  inHead: fc.boolean(),
  year: fc.integer({ min: 2019, max: 2024 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
  path: fc.constantFrom('src/config/a.ts', 'app/payments.ts', 'docs/people.md', 'lib/legacy.js'),
  /** Six graines seulement : les collisions d'empreinte sont voulues. */
  seed: fc.integer({ min: 1, max: 6 }),
});

const reportArb: fc.Arbitrary<PlacardReport> = fc.array(specArb, { maxLength: 14 }).map((specs) => {
  const findings = specs.map((spec, index) =>
    makeFinding({
      id: index + 1,
      family: spec.family,
      danger: spec.danger,
      state: spec.state,
      inHead: spec.inHead,
      introduced: refOf(`c-${index}`, `${spec.year}-${pad(spec.month)}-${pad(spec.day)}T09:00:00Z`),
      fingerprintSeed: `secret-${spec.seed}`,
      path: spec.path,
    }),
  );
  return makeReport(findings, { analyzedAt: '2024-06-01T00:00:00Z', totalCommits: specs.length + 3 });
});

const filterArb: fc.Arbitrary<FindingFilter> = fc.record({
  severities: fc.subarray([...SEVERITIES]),
  families: fc.subarray([...FAMILIES]),
  states: fc.subarray([...STATES]),
  inHead: fc.option(fc.boolean(), { nil: undefined }),
  fromYear: fc.option(fc.integer({ min: 2015, max: 2030 }), { nil: undefined }),
  toYear: fc.option(fc.integer({ min: 2015, max: 2030 }), { nil: undefined }),
  query: fc.option(fc.constantFrom('src', 'CLOUD', 'people', 'identity/', 'zzz', ''), { nil: undefined }),
});

const sortArb = fc.record({
  field: fc.constantFrom(...REGISTRY_SORT_FIELDS),
  direction: fc.constantFrom('asc' as const, 'desc' as const),
});

const idsOf = (findings: readonly { id: string }[]): string[] =>
  findings.map((finding) => finding.id).sort();

const doorCommits = (items: readonly CorridorItem[]): string[] =>
  items.filter((item) => item.kind === 'door').map((item) => item.commit);

describe('propriétés du modèle (PLA-P-11, PLA-P-12)', () => {
  it('les rapports de test respectent le schéma du rapport', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        expect(() => parseReport(report)).not.toThrow();
      }),
      { numRuns: 50 },
    );
  });

  it('PLA-P-11 : manoir et registre exposent le même ensemble pour tout filtre', () => {
    fc.assert(
      fc.property(reportArb, filterArb, sortArb, (report, filter, sort) => {
        const model = buildViewModel(report, filter, NOW);
        const rows = buildRegistryRows(model, sort);
        const expected = idsOf(applyFilters(report.findings, filter));
        expect(idsOf(model.findings)).toEqual(expected);
        expect(idsOf(rows.map((row) => row.finding))).toEqual(expected);
        expect(model.findings.length).toBeLessThanOrEqual(report.findings.length);
      }),
      { numRuns: 200 },
    );
  });

  it('PLA-P-11 (suite) : filtrer le résultat filtré ne retire rien de plus', () => {
    fc.assert(
      fc.property(reportArb, filterArb, (report, filter) => {
        const once = applyFilters(report.findings, filter);
        expect(idsOf(applyFilters(once, filter))).toEqual(idsOf(once));
        expect(idsOf(once.filter((finding) => matchesFilter(finding, filter)))).toEqual(idsOf(once));
      }),
      { numRuns: 100 },
    );
  });

  it('PLA-P-12 : un commit sans secret ne change aucune trouvaille', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const before = buildViewModel(report, emptyFilter(), NOW);
        const grown: PlacardReport = {
          ...report,
          repo: { ...report.repo, totalCommits: report.repo.totalCommits + 1, head: shaOf('brand-new-head') },
        };
        const after = buildViewModel(grown, emptyFilter(), NOW);
        expect(idsOf(after.findings)).toEqual(idsOf(before.findings));
        expect(after.hall).toEqual(before.hall);
        expect(after.floors.map((floor) => floor.year)).toEqual(before.floors.map((floor) => floor.year));
        for (let index = 0; index < before.floors.length; index += 1) {
          expect(doorCommits(after.floors[index]?.items ?? [])).toEqual(
            doorCommits(before.floors[index]?.items ?? []),
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it('PLA-P-12 (suite) : ajouter un commit sans secret n’ajoute aucune trouvaille au hall', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const grown: PlacardReport = {
          ...report,
          repo: { ...report.repo, totalCommits: report.repo.totalCommits + 7 },
        };
        expect(buildViewModel(grown, emptyFilter(), NOW).hall.total).toBe(report.findings.length);
      }),
      { numRuns: 50 },
    );
  });

  it('chaque porte et chaque ligne portent un libellé accessible non vide et informatif', () => {
    fc.assert(
      fc.property(reportArb, (report) => {
        const model = buildViewModel(report, emptyFilter(), NOW);
        for (const floor of model.floors) {
          for (const item of floor.items) {
            if (item.kind !== 'door') continue;
            expect(item.ariaLabel.startsWith('Door: commit ')).toBe(true);
            expect(item.ariaLabel).toContain('highest severity');
            expect(item.ariaLabel).toContain('finding');
          }
        }
        for (const row of buildRegistryRows(model, { field: 'danger', direction: 'asc' })) {
          expect(row.ariaLabel.length).toBeGreaterThan(20);
          expect(row.ariaLabel).toContain('danger');
          expect(row.ariaLabel).toContain('state');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('les couloirs restent chronologiques et les pans de mur comptent des commits réels', () => {
    fc.assert(
      fc.property(reportArb, filterArb, (report, filter) => {
        const model = buildViewModel(report, filter, NOW);
        for (const floor of model.floors) {
          const dates = floor.items
            .filter((item) => item.kind === 'door')
            .map((item) => Date.parse(item.date));
          expect([...dates].sort((a, b) => a - b)).toEqual(dates);
          for (const item of floor.items) {
            if (item.kind === 'wall') {
              expect(item.commits).toBeGreaterThan(0);
              expect(item.year).toBe(floor.year);
            }
          }
        }
        const timeline = new Set(model.floors.flatMap((floor) => floor.items.flatMap((item) =>
          item.kind === 'door' ? [item.commit] : [item.fromCommit, item.toCommit],
        )));
        expect(timeline.size).toBeLessThanOrEqual(report.findings.length * 3);
      }),
      { numRuns: 100 },
    );
  });
});
