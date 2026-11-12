import React from 'react';
import { describe, expect, it } from 'vitest';
import { within } from '@testing-library/dom';
import { buildRegistryRows } from '@placard/manor-model';
import type { Finding, RegistrySort } from '@placard/core';

import { Registry } from './Registry';
import { NOW } from './testing/fixtures';
import { demoModel } from './testing/model';
import { audit } from './testing/axe';
import { click, mount, press } from './testing/render';

/**
 * Le registre (PLA-F-18, PLA-F-19) : mêmes trouvailles que le manoir, triables,
 * navigables au clavier, chaque ligne portant son libellé complet.
 */

const model = demoModel();
const DEFAULT_SORT: RegistrySort = { field: 'danger', direction: 'desc' };

/** Monte le registre avec un tri piloté de l'extérieur. */
function mountRegistry(sort: RegistrySort = DEFAULT_SORT): {
  container: HTMLElement;
  selected: Finding[];
  sorts: RegistrySort[];
} {
  const selected: Finding[] = [];
  const sorts: RegistrySort[] = [];
  const view = mount(
    <Registry
      model={model}
      sort={sort}
      onSortChange={(next) => sorts.push(next)}
      onSelect={(finding) => selected.push(finding)}
      now={NOW}
    />,
  );
  return { container: view.container, selected, sorts };
}

describe('registre : données et tri', () => {
  it('affiche exactement les mêmes trouvailles que le manoir', () => {
    const view = mountRegistry();
    const rows = within(view.container).getAllByRole('row').slice(1);
    const expected = buildRegistryRows(model, DEFAULT_SORT).map((row) => row.finding.id);
    expect(rows.length).toBe(expected.length);
    expect(rows.map((row) => row.getAttribute('data-finding'))).toEqual(expected);
    // Le manoir expose le même ensemble via le modèle.
    expect(model.findings.map((finding) => finding.id).sort()).toEqual([...expected].sort());
  });

  it('trie par champ et annonce le sens avec aria-sort', () => {
    const view = mountRegistry();
    const headers = within(view.container).getAllByRole('columnheader');
    const danger = headers[0];
    expect(danger?.getAttribute('aria-sort')).toBe('descending');
    expect(headers[1]?.getAttribute('aria-sort')).toBe('none');
    const button = within(danger as HTMLElement).getByRole('button');
    return click(button).then(() => {
      expect(view.sorts).toEqual([{ field: 'danger', direction: 'asc' }]);
    });
  });

  it('remonte la trouvaille choisie au clic et au clavier', async () => {
    const view = mountRegistry();
    const rows = within(view.container).getAllByRole('row').slice(1);
    await click(rows[0] as Element);
    await press(rows[1] as Element, 'Enter');
    await press(rows[2] as Element, ' ');
    expect(view.selected.length).toBe(3);
    expect(view.selected[0]?.id).toBe(rows[0]?.getAttribute('data-finding'));
  });

  it('donne à chaque ligne un libellé accessible complet', () => {
    const view = mountRegistry();
    const rows = within(view.container).getAllByRole('row').slice(1);
    for (const row of rows) {
      const label = row.getAttribute('aria-label') ?? '';
      expect(label).toContain('rule ');
      expect(label).toContain('state ');
      expect(label).toContain('danger ');
      expect(label).toContain('out of 100');
    }
  });

  it('n’affiche aucune valeur brute, seulement l’aperçu masqué', () => {
    const view = mountRegistry();
    const text = view.container.textContent ?? '';
    expect(text).toContain('[REDACTED:');
    expect(text).not.toContain('AKIA');
  });

  it('marque la ligne sélectionnée pour la vue et pour les lecteurs d’écran', () => {
    const view = mount(
      <Registry
        model={model}
        sort={DEFAULT_SORT}
        onSortChange={() => undefined}
        onSelect={() => undefined}
        selectedId="sk_0003"
        now={NOW}
      />,
    );
    const row = view.container.querySelector('[data-finding="sk_0003"]');
    expect(row?.getAttribute('aria-current')).toBe('true');
    expect(row?.className).toContain('placard-registry__row--selected');
  });
});

describe('registre : accessibilité (axe-core)', () => {
  it('ne produit aucune violation critique ou sérieuse', async () => {
    const view = mountRegistry();
    expect(await audit(view.container)).toEqual([]);
  });
});
