import { describe, expect, it } from 'vitest';
import { FAMILY_TO_SKELETON } from '@placard/core';

import {
  clamp01,
  MAX_SCALE,
  MIN_OPACITY,
  MIN_SCALE,
  opacityForAge,
  scaleForDanger,
  severityColor,
  webStrands,
} from './illustrations/scale';
import { doorStateOf, topFindings } from './manor/DoorNode';
import { itemWidth, layoutManor } from './manor/layout';
import { clampIndex, nextDoorIndex } from './manor/navigation';
import { floorPositionLabel, summarizeFloors } from './manor/fallback';
import { floorsSpanned, trailSummary } from './FootprintSheet';
import { lastRemoval, lifetimeDaysOf } from './sheet-data';
import { demoModel, demoReport } from './testing/model';
import { NOW } from './testing/fixtures';
import { footprints } from '@placard/manor-model';

/**
 * Propriétés pures du rendu : échelles, géométrie, navigation.
 *
 * Aucun rendu DOM ici : ces fonctions sont la géométrie du manoir, et le
 * test doit pouvoir les exercise sans navigateur.
 */

describe('échelles : la taille suit le score, l’opacité suit l’âge', () => {
  it('fait croître la taille avec le score de danger', () => {
    expect(scaleForDanger(0)).toBeCloseTo(MIN_SCALE, 5);
    expect(scaleForDanger(100)).toBeCloseTo(MAX_SCALE, 5);
    expect(scaleForDanger(50)).toBeGreaterThan(scaleForDanger(10));
  });

  it('borne les scores hors limites', () => {
    expect(scaleForDanger(-40)).toBeCloseTo(MIN_SCALE, 5);
    expect(scaleForDanger(400)).toBeCloseTo(MAX_SCALE, 5);
    expect(scaleForDanger(Number.NaN)).toBeCloseTo(MIN_SCALE, 5);
  });

  it('fait pâlir l’encre avec l’âge', () => {
    expect(opacityForAge(0)).toBeCloseTo(1, 5);
    expect(opacityForAge(10_000)).toBeCloseTo(MIN_OPACITY, 5);
    expect(opacityForAge(100)).toBeLessThan(opacityForAge(10));
  });

  it('compte les brins de toile selon l’âge', () => {
    expect(webStrands(0)).toBe(1);
    expect(webStrands(10_000)).toBe(5);
    expect(webStrands(365)).toBeGreaterThan(webStrands(10));
    expect(webStrands(1460)).toBe(5);
  });

  it('borne les valeurs hors limites', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it('associe une couleur à chaque gravité, jamais « none »', () => {
    expect(severityColor('none')).toBe(severityColor('low'));
    expect(severityColor('critical')).not.toBe(severityColor('low'));
  });
});

describe('géométrie du manoir', () => {
  it('donne à chaque porte une largeur fixe et à chaque mur une largeur proportionnelle', () => {
    expect(itemWidth({ kind: 'door', commit: 'a', shortCommit: 'a', date: '', year: 2024, severity: 'low', ageDays: 0, findings: [], sealed: 0, dismissed: 0, ariaLabel: '' })).toBe(64);
    const small = itemWidth({ kind: 'wall', commits: 2, year: 2024, fromCommit: 'a', toCommit: 'b' });
    const large = itemWidth({ kind: 'wall', commits: 312, year: 2024, fromCommit: 'a', toCommit: 'b' });
    expect(small).toBeLessThan(large);
    expect(large).toBeLessThanOrEqual(240);
  });

  it('place les portes de gauche à droite, sans chevauchement', () => {
    const layout = layoutManor(demoModel());
    for (const floor of layout.floors) {
      for (let index = 1; index < floor.doors.length; index += 1) {
        const previous = floor.doors[index - 1];
        const current = floor.doors[index];
        if (previous === undefined || current === undefined) continue;
        expect(current.x).toBeGreaterThan(previous.x);
      }
    }
  });

  it('place le grenier en haut et le rez-de-chaussée en bas', () => {
    const layout = layoutManor(demoModel());
    expect(layout.floors[0]?.floor.attic).toBe(true);
    expect(layout.floors[layout.floors.length - 1]?.floor.ground).toBe(true);
    const ys = layout.floors.map((floor) => floor.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
});

describe('navigation clavier', () => {
  const layout = layoutManor(demoModel());

  it('avance et recule dans l’ordre du couloir', () => {
    expect(nextDoorIndex(layout, 0, 'ArrowRight')).toBe(1);
    expect(nextDoorIndex(layout, 1, 'ArrowLeft')).toBe(0);
    expect(nextDoorIndex(layout, 0, 'ArrowLeft')).toBe(0);
    expect(nextDoorIndex(layout, layout.order.length - 1, 'ArrowRight')).toBe(layout.order.length - 1);
  });

  it('va au premier et au dernier couloir avec Origine et Fin', () => {
    expect(nextDoorIndex(layout, 2, 'Home')).toBe(0);
    expect(nextDoorIndex(layout, 0, 'End')).toBe(layout.order.length - 1);
  });

  it('change d’étage en gardant l’abscisse', () => {
    const index = nextDoorIndex(layout, 0, 'ArrowDown');
    expect(layout.order[index]?.floorIndex).toBe(1);
    const up = nextDoorIndex(layout, index, 'ArrowUp');
    expect(layout.order[up]?.floorIndex).toBe(0);
  });

  it('borne les index hors limites', () => {
    expect(clampIndex(-5, 3)).toBe(0);
    expect(clampIndex(9, 3)).toBe(2);
    expect(clampIndex(0, 0)).toBe(-1);
    // L'étage du dessous a une porte : la descente y va, elle ne reste pas en place.
    expect(nextDoorIndex(layout, 0, 'ArrowDown')).toBe(1);
  });
});

describe('états de porte et repli', () => {
  it('déduit l’état visible de la porte du modèle', () => {
    const model = demoModel();
    const states = model.floors.flatMap((floor) =>
      floor.items.filter((item) => item.kind === 'door').map((item) => doorStateOf(item)),
    );
    expect(states).toContain('sealed');
    expect(states).toContain('ribbon');
    expect(states).toContain('alert');
    expect(states).toContain('normal');
  });

  it('garde les trouvailles les plus dangereuses pour le dessin', () => {
    const model = demoModel();
    const door = model.floors.flatMap((floor) => floor.items).find((item) => item.kind === 'door');
    if (door === undefined || door.kind !== 'door') throw new Error('fixture manquante');
    const top = topFindings(door, 1);
    expect(top.length).toBe(1);
    expect(top[0]?.danger).toBe(Math.max(...door.findings.map((finding) => finding.danger)));
  });

  it('résume chaque étage pour le repli lisible', () => {
    const lines = summarizeFloors(demoModel());
    expect(lines.length).toBe(3);
    expect(lines[0]?.attic).toBe(true);
    expect(floorPositionLabel(lines[0] as (typeof lines)[number])).toBe('attic');
  });
});

describe('données de fiche', () => {
  it('mesure la durée de vie jusqu’au dernier retrait', () => {
    const report = demoReport();
    const finding = report.findings[0];
    if (finding === undefined) throw new Error('fixture manquante');
    expect(lastRemoval(finding)).toBeUndefined();
    expect(lifetimeDaysOf(finding, NOW)).toBeGreaterThan(0);
  });

  it('résume une trace d’empreintes', () => {
    const report = demoReport();
    const finding = report.findings[0];
    if (finding === undefined) throw new Error('fixture manquante');
    const trail = footprints(report, finding);
    expect(floorsSpanned(trail)).toBeGreaterThanOrEqual(1);
    expect(trailSummary(trail)).toContain('Lived');
  });

  it('associe chaque famille à un type de squelette', () => {
    expect(FAMILY_TO_SKELETON['private-key']).toBe('key-bearer');
    expect(FAMILY_TO_SKELETON['bank-data']).toBe('paper-bearer');
    expect(FAMILY_TO_SKELETON['risky-file']).toBe('chest');
    expect(FAMILY_TO_SKELETON['suspicious-string']).toBe('loose-bones');
  });
});
