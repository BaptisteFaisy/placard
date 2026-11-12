import React from 'react';
import { describe, expect, it } from 'vitest';
import { within } from '@testing-library/dom';

import { Legend, LegendToggle } from './Legend';
import { audit } from './testing/axe';
import { click, mount } from './testing/render';

/**
 * La légende doit être **atteignable depuis tout écran** (PLA-F-15) : le
 * bouton d'accès est exporté séparément, pour être posé par l'application sur
 * le registre comme sur le rituel.
 */

describe('accès à la légende', () => {
  it('expose un bouton Annoncer son état ouvert et fermé', async () => {
    const opened: boolean[] = [];
    const view = mount(<LegendToggle open={false} onToggle={() => opened.push(true)} />);
    const button = within(view.container).getByRole('button', { name: 'What does the manor mean?' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    await click(button);
    expect(opened).toEqual([true]);
  });

  it('reste sans violation axe une fois la légende ouverte', async () => {
    const view = mount(<Legend open onClose={() => undefined} />);
    expect(await audit(view.container)).toEqual([]);
  });
});
