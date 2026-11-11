import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { FAMILY_TO_SKELETON, FAMILIES, findingAriaLabel, familyLabel, skeletonLabel } from './i18n.js';
import { compareSeverity, maxSeverity, severityOf, SEVERITY_ORDER } from './severity.js';

describe('severityOf', () => {
  it('respecte les seuils documentés', () => {
    expect(severityOf(100)).toBe('critical');
    expect(severityOf(85)).toBe('critical');
    expect(severityOf(84)).toBe('high');
    expect(severityOf(65)).toBe('high');
    expect(severityOf(64)).toBe('medium');
    expect(severityOf(40)).toBe('medium');
    expect(severityOf(39)).toBe('low');
    expect(severityOf(0)).toBe('low');
  });

  it('tout score produit un niveau connu (fast-check)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (danger) => {
        return SEVERITY_ORDER.includes(severityOf(danger));
      }),
    );
  });

  it('maxSeverity renvoie le niveau le plus grave', () => {
    expect(maxSeverity([10, 90, 50])).toBe('critical');
    expect(maxSeverity([])).toBe('none');
    expect(compareSeverity('critical', 'low')).toBeLessThan(0);
  });
});

describe('i18n', () => {
  it('chaque famille a un squelette et deux libellés', () => {
    for (const family of FAMILIES) {
      expect(FAMILY_TO_SKELETON[family]).toBeDefined();
      expect(familyLabel(family, 'en').length).toBeGreaterThan(2);
      expect(familyLabel(family, 'fr').length).toBeGreaterThan(2);
      expect(skeletonLabel(FAMILY_TO_SKELETON[family], 'en').length).toBeGreaterThan(2);
    }
  });

  it('le libellé accessible ne contient jamais l’aperçu brut d’une valeur longue', () => {
    const label = findingAriaLabel({
      preview: 'AKIA…(20)',
      family: 'cloud-key',
      danger: 85,
      inHead: true,
    });
    expect(label).toContain('Cloud provider key');
    expect(label).toContain('Critical');
    expect(label).toContain('still standing');
  });
});
