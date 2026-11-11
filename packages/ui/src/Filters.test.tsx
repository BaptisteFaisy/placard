import React from 'react';
import { describe, expect, it } from 'vitest';
import { within } from '@testing-library/dom';
import { buildViewModel, emptyFilter } from '@placard/manor-model';
import type { FindingFilter, ManorViewModel } from '@placard/core';

import { Filters, headChoiceOf, toggle, withHeadChoice } from './Filters.js';
import { Manor } from './Manor.js';
import { Registry } from './Registry.js';
import { NOW } from './testing/fixtures.js';
import { demoReport } from './testing/model.js';
import { click, mount, type Mounted } from './testing/render.js';

/**
 * Les filtres (PLA-F-19) et la propriété PLA-P-11 : pour tout jeu de filtres,
 * le manoir et le registre exposent exactement le même ensemble de trouvailles.
 */

const report = demoReport();

/** Applique un filtre au rapport, comme le ferait l'application. */
function modelFor(filter: FindingFilter): ManorViewModel {
  return buildViewModel(report, filter, NOW);
}

/** Trouvailles visibles dans le manoir : celles d'une porte affichée. */
function manorFindingIds(container: HTMLElement, model: ManorViewModel): string[] {
  const commits = new Set(
    [...container.querySelectorAll('[role="button"]')].map((door) => door.getAttribute('data-commit')),
  );
  const visible = model.findings.filter((finding) =>
    [finding.introduced.commit, ...finding.removed.map((ref) => ref.commit)].some((commit) =>
      commits.has(commit),
    ),
  );
  return visible.map((finding) => finding.id).sort();
}

/** Trouvailles visibles dans le registre : les lignes du tableau. */
function registryFindingIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('tr[data-finding]')]
    .map((row) => row.getAttribute('data-finding') ?? '')
    .sort();
}

/** Monte les deux vues sur le même modèle, comme le fait l'application. */
function mountBothViews(filter: FindingFilter): {
  manor: Mounted;
  registry: Mounted;
  model: ManorViewModel;
} {
  const model = modelFor(filter);
  const manor = mount(<Manor model={model} now={NOW} />);
  const registry = mount(
    <Registry
      model={model}
      sort={{ field: 'danger', direction: 'desc' }}
      onSortChange={() => undefined}
      onSelect={() => undefined}
      now={NOW}
    />,
  );
  return { manor, registry, model };
}

/** Identifiants attendus dans le registre : exactement `model.findings`. */
function expectedIds(model: ManorViewModel): string[] {
  return model.findings.map((finding) => finding.id).sort();
}

describe('filtres : application aux deux vues (PLA-P-11)', () => {
  it('expose le même ensemble sans filtre', () => {
    const { manor, registry, model } = mountBothViews(emptyFilter());
    expect(registryFindingIds(registry.container)).toEqual(expectedIds(model));
    expect(manorFindingIds(manor.container, model)).toEqual(registryFindingIds(registry.container));
  });

  it('expose le même ensemble filtré par état', () => {
    const { manor, registry, model } = mountBothViews({ severities: [], families: [], states: ['open'] });
    expect(model.findings.length).toBe(2);
    expect(registryFindingIds(registry.container)).toEqual(expectedIds(model));
    expect(manorFindingIds(manor.container, model)).toEqual(registryFindingIds(registry.container));
  });

  it('expose le même ensemble filtré par gravité', () => {
    const { manor, registry, model } = mountBothViews({ severities: ['critical'], families: [], states: [] });
    expect(model.findings.length).toBe(1);
    expect(registryFindingIds(registry.container)).toEqual(expectedIds(model));
    expect(manorFindingIds(manor.container, model)).toEqual(registryFindingIds(registry.container));
  });

  it('expose le même ensemble filtré par présence dans HEAD', () => {
    const { manor, registry, model } = mountBothViews({ severities: [], families: [], states: [], inHead: false });
    expect(model.findings.length).toBe(1);
    expect(manorFindingIds(manor.container, model)).toEqual(registryFindingIds(registry.container));
  });

  it('expose le même ensemble filtré par recherche texte', () => {
    const { manor, registry, model } = mountBothViews({
      severities: [],
      families: [],
      states: [],
      query: 'bank',
    });
    expect(model.findings.length).toBe(1);
    expect(manorFindingIds(manor.container, model)).toEqual(registryFindingIds(registry.container));
  });
});

describe('filtres : contrôles', () => {
  it('produit un filtre de gravité depuis la case à cocher', async () => {
    const changes: FindingFilter[] = [];
    const view = mount(
      <Filters filter={emptyFilter()} onChange={(next) => changes.push(next)} years={[2021, 2024]} matched={4} />,
    );
    await click(within(view.container).getByRole('checkbox', { name: /Critical/ }));
    expect(changes[0]?.severities).toEqual(['critical']);
  });

  it('produit un filtre de famille puis d’état', async () => {
    const changes: FindingFilter[] = [];
    const view = mount(
      <Filters filter={emptyFilter()} onChange={(next) => changes.push(next)} years={[2021, 2024]} matched={4} />,
    );
    await click(within(view.container).getByRole('checkbox', { name: 'Banking data' }));
    expect(changes[0]?.families).toEqual(['bank-data']);
    await click(within(view.container).getByRole('checkbox', { name: 'Dismissed' }));
    expect(changes[1]?.states).toEqual(['ignored']);
  });

  it('annonce le nombre de trouvailles retenues en direct', () => {
    const view = mount(
      <Filters filter={emptyFilter()} onChange={() => undefined} years={[2021, 2024]} matched={3} />,
    );
    expect(within(view.container).getByRole('status').textContent).toContain('3 findings match');
  });

  it('convertit la présence dans HEAD dans les deux sens', () => {
    const base = emptyFilter();
    expect(headChoiceOf(base)).toBe('all');
    const inHead = withHeadChoice(base, 'in');
    expect(inHead.inHead).toBe(true);
    expect(headChoiceOf(inHead)).toBe('in');
    const out = withHeadChoice(inHead, 'out');
    expect(out.inHead).toBe(false);
    expect(headChoiceOf(out)).toBe('out');
    expect(headChoiceOf(withHeadChoice(out, 'all'))).toBe('all');
  });

  it('bascule une valeur sans créer de doublon', () => {
    expect(toggle([], 'high')).toEqual(['high']);
    expect(toggle(['high'], 'high')).toEqual([]);
    expect(toggle(['high'], 'low')).toEqual(['high', 'low']);
  });
});
