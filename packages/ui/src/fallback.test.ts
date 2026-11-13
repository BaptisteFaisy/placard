import { describe, expect, it } from 'vitest';
import { buildViewModel, emptyFilter } from '@placard/manor-model';
import type { Finding, PlacardReport } from '@placard/core';

import { fallbackReason, MAX_RENDERED_DOORS, planFor, summarizeFloors } from './manor/fallback';
import { makeFinding, makeReport, refOf } from './testing/fixtures';
import { NOW } from './testing/fixtures';

/**
 * Le repli lisible doit tenir à 500 portes (exigence du cahier des charges) :
 * au-delà, le SVG complet coûte des milliers de nœuds et le registre prend le
 * relais — avec les mêmes données.
 */

/** Construit un rapport de `count` trouvailles, une par an. */
function bigReport(count: number): PlacardReport {
  const findings: Finding[] = [];
  for (let index = 0; index < count; index += 1) {
    findings.push(
      makeFinding({
        id: index + 1,
        introduced: refOf(`big-${index}`, `${2000 + (index % 24)}-01-01T00:00:00Z`),
        danger: 40,
        path: `src/file-${index}.ts`,
      }),
    );
  }
  return makeReport(findings, { name: 'big-repo' });
}

describe('repli lisible : 500 portes', () => {
  it('bascule sur le repli à partir du seuil', () => {
    const model = buildViewModel(bigReport(MAX_RENDERED_DOORS), emptyFilter(), NOW);
    expect(fallbackReason(model, MAX_RENDERED_DOORS).needed).toBe(true);
    expect(planFor(model, MAX_RENDERED_DOORS)).toBeNull();
  });

  it('reste en SVG juste en dessous du seuil', () => {
    const model = buildViewModel(bigReport(MAX_RENDERED_DOORS - 1), emptyFilter(), NOW);
    expect(fallbackReason(model, MAX_RENDERED_DOORS).needed).toBe(false);
    expect(planFor(model, MAX_RENDERED_DOORS)).not.toBeNull();
  });

  it('résume chaque étage sans perdre de trouvailles', () => {
    const model = buildViewModel(bigReport(120), emptyFilter(), NOW);
    const lines = summarizeFloors(model);
    const total = lines.reduce((sum, line) => sum + line.findings, 0);
    expect(total).toBe(model.findings.length);
    expect(lines.length).toBe(model.floors.length);
  });

  it('conserve le compte de portes dans le motif du repli', () => {
    const model = buildViewModel(bigReport(MAX_RENDERED_DOORS), emptyFilter(), NOW);
    const reason = fallbackReason(model, MAX_RENDERED_DOORS);
    expect(reason.doors).toBe(MAX_RENDERED_DOORS);
    expect(reason.limit).toBe(MAX_RENDERED_DOORS);
  });
});
