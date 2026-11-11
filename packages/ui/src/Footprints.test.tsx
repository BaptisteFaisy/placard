import React from 'react';
import { describe, expect, it } from 'vitest';

import { Manor } from './Manor.js';
import { Footprints } from './Footprints.js';
import { FootprintSheet } from './FootprintSheet.js';
import { NOW } from './testing/fixtures.js';
import { demoModel, demoReport } from './testing/model.js';
import { mount } from './testing/render.js';
import { footprints } from '@placard/manor-model';
import { layoutManor } from './manor/layout.js';

/**
 * Empreintes de pas osseuses (PLA-F-17) : la durée de vie d'un secret, de sa
 * porte d'introduction à ses portes de retrait, y compris sur plusieurs étages.
 */

const report = demoReport();
const model = demoModel();
const layout = layoutManor(model);
const first = report.findings[0];

describe('empreintes de pas', () => {
  it('trace une empreinte par porte de la trace, sur les étages concernés', () => {
    if (first === undefined) throw new Error('fixture manquante');
    const trail = footprints(report, first);
    const view = mount(
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`}>
        <Footprints layout={layout} trail={trail} />
      </svg>,
    );
    const marks = view.container.querySelectorAll('.placard-footprint');
    expect(marks.length).toBe(trail.doors.length);
    expect(trail.doors.length).toBeGreaterThan(0);
  });

  it('relie les portes d’un secret qui traverse plusieurs étages', () => {
    const multi = demoReport();
    const shared = multi.findings[0];
    if (shared === undefined) throw new Error('fixture manquante');
    const twin = multi.findings[1];
    if (twin === undefined) throw new Error('fixture manquante');
    // Même empreinte = même secret : les deux portes sont reliées.
    twin.fingerprint = shared.fingerprint;
    const trail = footprints(multi, shared);
    const years = new Set(trail.doors.map((door) => door.year));
    expect(years.size).toBe(2);
    const label = trail.ariaLabel;
    expect(label).toContain('across');
    expect(label).toContain('floors');
  });

  it('ignore une porte absente du plan au lieu d’inventer une coordonnée', () => {
    const view = mount(
      <svg viewBox="0 0 400 200">
        <Footprints
          layout={layout}
          trail={{
            fingerprint: 'hmac256:0',
            doors: [{ commit: 'inconnu', year: 2021, role: 'introduced' }],
            lifetimeDays: 10,
            ariaLabel: 'trace fantôme',
          }}
        />
      </svg>,
    );
    expect(view.container.querySelector('.placard-footprint')).toBeNull();
  });

  it('ne rend rien sans trace sélectionnée', () => {
    const view = mount(
      <svg viewBox="0 0 400 200">
        <Footprints layout={layout} trail={null} />
      </svg>,
    );
    expect(view.container.querySelector('.placard-footprints')).toBeNull();
  });

  it('expose le libellé complet de la trace dans la fiche d’empreintes', () => {
    if (first === undefined) throw new Error('fixture manquante');
    const trail = footprints(report, first);
    const view = mount(<FootprintSheet trail={trail} />);
    expect(view.container.textContent).toContain(trail.ariaLabel);
  });
});

describe('manoir avec empreintes', () => {
  it('affiche le tracé quand une trace est fournie', () => {
    if (first === undefined) throw new Error('fixture manquante');
    const trail = footprints(report, first);
    const view = mount(<Manor model={model} now={NOW} trail={trail} />);
    const group = view.container.querySelector('.placard-footprints');
    expect(group).toBeTruthy();
    expect(group?.getAttribute('aria-label')).toBe(trail.ariaLabel);
  });
});
