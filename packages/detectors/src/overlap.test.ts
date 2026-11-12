import type { DetectorRule, RawDetection } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { createDetectorEngine } from './index';
import { compareDetections, overlaps, resolveOverlaps } from './overlap';
import { RULE_IDS } from './registry';
import { fixture, inputOf } from './testing/fixtures';

/**
 * Résolution des chevauchements : la règle la plus prioritaire gagne, et une
 * valeur ne produit qu'**une seule** détection.
 */

/** Détection de test, positionnée à la main. */
function detection(rule: string, start: number, end: number, confidence = 0.5): RawDetection {
  return { rule, family: 'cloud-key', value: 'x', start, end, confidence };
}

describe('overlap resolution', () => {
  it('detects two overlapping intervals', () => {
    expect(overlaps(detection('a', 0, 10), detection('b', 5, 15))).toBe(true);
    expect(overlaps(detection('a', 0, 10), detection('b', 10, 15))).toBe(false);
  });

  it('keeps the higher-priority rule', () => {
    const priorities = new Map([
      ['low', 1],
      ['high', 90],
    ]);
    const kept = resolveOverlaps([detection('low', 0, 20), detection('high', 5, 15)], priorities);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.rule).toBe('high');
  });

  it('breaks priority ties by confidence, then by length', () => {
    const priorities = new Map([
      ['a', 10],
      ['b', 10],
    ]);
    const byConfidence = resolveOverlaps(
      [detection('a', 0, 10, 0.4), detection('b', 0, 10, 0.8)],
      priorities,
    );
    expect(byConfidence[0]?.rule).toBe('b');
    const byLength = resolveOverlaps([detection('a', 0, 10), detection('b', 0, 18)], priorities);
    expect(byLength[0]?.rule).toBe('b');
  });

  it('never returns two overlapping detections', () => {
    const priorities = new Map([['a', 5], ['b', 5], ['c', 5]]);
    const kept = resolveOverlaps(
      [detection('a', 0, 10), detection('b', 5, 15), detection('c', 12, 20)],
      priorities,
    );
    for (let i = 0; i < kept.length; i += 1) {
      for (let j = i + 1; j < kept.length; j += 1) {
        expect(overlaps(kept[i]!, kept[j]!)).toBe(false);
      }
    }
  });

  it('returns detections in line order', () => {
    const priorities = new Map([['a', 1]]);
    const kept = resolveOverlaps([detection('a', 30, 40), detection('a', 0, 10)], priorities);
    expect(kept.map((d) => d.start)).toEqual([0, 30]);
  });

  it('drops empty spans', () => {
    expect(resolveOverlaps([detection('a', 5, 5)], new Map())).toHaveLength(0);
  });

  it('compares by priority before anything else', () => {
    const priorities = new Map([
      ['weak', 0],
      ['strong', 50],
    ]);
    expect(compareDetections(priorities, detection('strong', 0, 4), detection('weak', 0, 90))).toBeLessThan(0);
  });
});

describe('overlap resolution on real rules', () => {
  it('reports a platform token once, not also as a suspicious string', () => {
    for (let index = 0; index < 12; index += 1) {
      const value = fixture('platform-token', 'overlap', index);
      const rules = createDetectorEngine()
        .scanLine(inputOf(`token = ${value}`))
        .detections.map((d) => d.rule);
      expect(rules).toHaveLength(1);
      expect(rules[0]?.startsWith('platform-')).toBe(true);
    }
  });

  it('reports a cloud key once, not also as a suspicious string', () => {
    for (let index = 0; index < 12; index += 1) {
      const value = fixture('cloud-key', 'overlap-cloud', index);
      const rules = createDetectorEngine()
        .scanLine(inputOf(`api_key = ${value}`))
        .detections.map((d) => d.rule);
      expect(rules).toHaveLength(1);
      expect(rules[0]?.startsWith('cloud-')).toBe(true);
    }
  });

  it('keeps two distinct values on the same line as two detections', () => {
    const first = fixture('cloud-key', 'two', 0);
    const second = fixture('cloud-key', 'two', 1);
    const detections = createDetectorEngine()
      .scanLine(inputOf(`a = ${first} b = ${second}`))
      .detections;
    expect(detections).toHaveLength(2);
    expect(detections[0]!.value).not.toBe(detections[1]!.value);
  });

  it('lets a custom rule outrank a builtin rule on the same span', () => {
    const value = fixture('cloud-key', 'custom-priority', 0);
    const custom: DetectorRule = {
      id: 'custom-wins',
      family: 'suspicious-string',
      name: 'Custom override',
      keywords: ['api_key'],
      pattern: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      priority: 500,
    };
    const engine = createDetectorEngine({ customRules: [custom] });
    const rules = engine.scanLine(inputOf(`api_key = ${value}`)).detections.map((d) => d.rule);
    expect(rules).toContain('custom-wins');
    expect(rules).not.toContain(RULE_IDS.cloudAccessKey);
  });
});
