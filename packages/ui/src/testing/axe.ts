import axe from 'axe-core';
import type { AxeResults, RunOptions } from 'axe-core';

/**
 * Lancement d'axe-core partagé par les suites d'interface.
 *
 * La règle `color-contrast` est désactivée : elle a besoin d'un canvas pour
 * mesurer les pixels, que jsdom n'implémente pas. Les contrastes réels sont
 * tenus par `theme.css` et vérifiés à la main (palette de `art-direction.md`),
 * pas ici.
 */
export const AXE_OPTIONS: RunOptions = {
  resultTypes: ['violations'],
  rules: { 'color-contrast': { enabled: false } },
};

/** Violations d'impact `critical` ou `serious` : ce qui bloque la livraison. */
export function blockingViolations(results: AxeResults): string[] {
  return results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => `${violation.id} (${violation.impact})`);
}

/** Toutes les violations, sous forme lisible, pour les messages d'échec. */
export function allViolations(results: AxeResults): string[] {
  return results.violations.map((violation) => `${violation.id} (${violation.impact ?? 'unknown'})`);
}

/** Analyse un fragment de DOM et renvoie les violations bloquantes. */
export async function audit(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, AXE_OPTIONS);
  return blockingViolations(results);
}
