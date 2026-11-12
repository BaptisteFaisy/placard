import React from 'react';
import { describe, expect, it } from 'vitest';

import { Manor } from './Manor';
import { NOW } from './testing/fixtures';
import { demoModel } from './testing/model';
import { fire, mount } from './testing/render';

/**
 * La lanterne suit le focus (PLA-F-15) : le pointeur comme le clavier
 * déplacent la lumière sur la trouvaille active.
 */

describe('lanterne : suivi du focus', () => {
  it('suit le pointeur quand il survole une porte', async () => {
    const view = mount(<Manor model={demoModel()} now={NOW} />);
    const before = view.container.querySelector('.placard-lantern')?.getAttribute('transform');
    const doors = [...view.container.querySelectorAll('[role="button"]')];
    await fire(doors[2] as Element, new MouseEvent('pointerover', { bubbles: true }));
    const after = view.container.querySelector('.placard-lantern')?.getAttribute('transform');
    expect(after).not.toBe(before);
  });

  it('suit le clavier quand la flèche droite est pressée', async () => {
    const view = mount(<Manor model={demoModel()} now={NOW} />);
    const doors = [...view.container.querySelectorAll('[role="button"]')];
    const before = view.container.querySelector('.placard-lantern')?.getAttribute('transform');
    await fire(doors[0] as Element, new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const after = view.container.querySelector('.placard-lantern')?.getAttribute('transform');
    expect(after).not.toBe(before);
  });
});
