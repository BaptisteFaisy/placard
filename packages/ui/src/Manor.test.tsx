import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { within } from '@testing-library/dom';

import { Manor } from './Manor.js';
import { NOW } from './testing/fixtures.js';
import { demoModel, openOnlyModel } from './testing/model.js';
import { audit } from './testing/axe.js';
import { cleanup, click, mount, press, type Mounted } from './testing/render.js';

/**
 * Tests du manoir (PLA-F-14, PLA-F-15, PLA-F-17, PLA-F-21).
 *
 * Aucun `jest-dom` dans ce dépôt : les assertions passent par `toBeTruthy()`
 * et `getAttribute()`. Le rendu se fait via `react-dom/client` (voir
 * `testing/render.tsx`), ce qui évite le conflit React 18/19 du lockfile.
 */

const mounted: Mounted[] = [];

function render(ui: React.ReactElement): Mounted {
  const view = mount(ui);
  mounted.push(view);
  return view;
}

afterEach(() => {
  while (mounted.length > 0) cleanup(mounted.pop() as Mounted);
});

/** Les portes interactives du manoir, dans l'ordre de navigation. */
function doors(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[role="button"]')];
}

describe('manoir : structure et correspondance costume ↔ données', () => {
  it('rend un étage par année, du grenier au rez-de-chaussée', () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    const floors = [...view.container.querySelectorAll('[role="group"]')];
    expect(floors.length).toBe(3);
    expect(floors.map((floor) => floor.getAttribute('data-year'))).toEqual(['2021', '2023', '2024']);
    expect(floors[0]?.textContent).toContain('attic');
    expect(floors[2]?.textContent).toContain('ground floor');
  });

  it('rend une porte par commit porteur de trouvaille, avec son libellé complet', () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    const items = doors(view.container);
    expect(items.length).toBe(4);
    for (const item of items) {
      const label = item.getAttribute('aria-label') ?? '';
      expect(label.startsWith('Door: commit ')).toBe(true);
      expect(label).toContain('highest severity');
    }
  });

  it('compresse les commits sans trouvaille en pans de mur étiquetés', () => {
    const view = render(<Manor model={openOnlyModel()} now={NOW} />);
    const walls = [...view.container.querySelectorAll('.placard-wall-node')];
    expect(walls.length).toBe(2);
    expect(walls[0]?.getAttribute('aria-label')).toContain('without any finding');
    expect(walls[0]?.textContent).toMatch(/^\d+ commits?$/);
    // Les murs compressent bien des commits : la donnée est sur le pan.
    expect(Number(walls[0]?.getAttribute('data-commits'))).toBeGreaterThan(0);
  });

  it('code la gravité derrière la porte par la lueur, doublée d’un texte', () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    const states = doors(view.container).map((door) => door.getAttribute('data-state'));
    expect(states).toContain('sealed');
    expect(states).toContain('ribbon');
    expect(states).toContain('alert');
  });

  it('ouvre la fenêtre du couloir seulement si le distant est public', () => {
    const open = render(<Manor model={demoModel()} now={NOW} />);
    expect(open.container.querySelector('.placard-manor__window')).toBeTruthy();
    cleanup(mounted.pop() as Mounted);
    const closed = render(<Manor model={openOnlyModel()} now={NOW} />);
    expect(closed.container.textContent).toContain('public remote');
  });
});

describe('manoir : navigation clavier et fiche', () => {
  it('déplace le focus logique avec les flèches', async () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    const items = doors(view.container);
    expect(items[0]?.getAttribute('tabindex')).toBe('0');
    await press(items[0] as Element, 'ArrowRight');
    const after = doors(view.container);
    expect(after[1]?.getAttribute('tabindex')).toBe('0');
    expect(after[0]?.getAttribute('tabindex')).toBe('-1');
  });

  it('change d’étage avec les flèches haut et bas', async () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    await press(doors(view.container)[0] as Element, 'ArrowDown');
    const floorOfSecond = doors(view.container)[1]?.closest('[role="group"]')?.getAttribute('data-year');
    expect(floorOfSecond).toBe('2023');
  });

  it('ouvre une porte au clavier et affiche le score avec ses raisons', async () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    await click(doors(view.container)[0] as Element);
    const sheet = within(view.container).getByRole('dialog');
    expect(sheet.getAttribute('aria-label')).toContain('Finding sheet');
    expect(sheet.textContent).toContain('Danger 95 out of 100');
    expect(sheet.textContent).toContain('base cloud-key: +85');
    expect(sheet.textContent).toContain('still present in HEAD: +15');
    expect(sheet.textContent).toContain('still standing in current code');
    // Jamais de valeur brute : seul l'aperçu masqué est affiché.
    expect(sheet.textContent).toContain('[REDACTED:cloud-key](24)');
  });

  it('ferme la fiche avec la touche Échap', async () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    await click(doors(view.container)[0] as Element);
    expect(within(view.container).queryByRole('dialog')).toBeTruthy();
    await press(view.container, 'Escape');
    expect(within(view.container).queryByRole('dialog')).toBeNull();
  });

  it('garde la lanterne sur la porte active', async () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    const lantern = view.container.querySelector('.placard-lantern');
    const before = lantern?.getAttribute('transform');
    await press(doors(view.container)[0] as Element, 'ArrowRight');
    const after = view.container.querySelector('.placard-lantern')?.getAttribute('transform');
    expect(before).toBeTruthy();
    expect(after).not.toBe(before);
  });
});

describe('manoir : repli lisible et préférences', () => {
  it('bascule sur le repli textuel au-delà du seuil de portes', () => {
    const view = render(<Manor model={demoModel()} now={NOW} maxDoors={1} />);
    expect(view.container.querySelector('.placard-fallback')).toBeTruthy();
    expect(view.container.querySelector('[role="application"]')).toBeNull();
    expect(view.container.textContent).toContain('2021');
  });

  it('pose la classe de mouvement réduit quand la préférence est active', () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const view = render(<Manor model={demoModel()} now={NOW} />);
    expect(view.container.querySelector('.placard-manor')?.className).toContain('placard--reduced-motion');
    window.matchMedia = original;
  });

  it('ne pose pas la classe quand le mouvement est autorisé', () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    expect(view.container.querySelector('.placard-manor')?.className).not.toContain('placard--reduced-motion');
  });
});

describe('manoir : accessibilité (axe-core)', () => {
  it('ne produit aucune violation critique ou sérieuse', async () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    expect(await audit(view.container)).toEqual([]);
  });

  it('reste sans violation critique avec la fiche ouverte', async () => {
    const view = render(<Manor model={demoModel()} now={NOW} />);
    await click(doors(view.container)[0] as Element);
    expect(await audit(view.container)).toEqual([]);
  });
});
