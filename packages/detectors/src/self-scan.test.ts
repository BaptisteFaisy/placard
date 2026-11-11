import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDetectorEngine } from './index.js';
import { inputOf } from './testing/fixtures.js';

/**
 * PLA-N-09 vu depuis le paquet lui-même : le code de `@placard/detectors` ne
 * contient aucune valeur que ses propres règles signaleraient.
 *
 * C'est la contrepartie vérifiable du découpage des préfixes en fragments
 * (`signatures.ts`) : si quelqu'un écrit un jour un préfixe d'un seul tenant
 * dans ce paquet, ce test tombe.
 */

const engine = createDetectorEngine();

/** Racine des sources du paquet (ce fichier vit dans `src/`). */
const SOURCE_DIR = new URL('.', import.meta.url).pathname;

/** Liste récursivement les fichiers TypeScript d'un dossier. */
function listSources(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...listSources(path));
    else if (path.endsWith('.ts')) found.push(path);
  }
  return found;
}

describe('the package does not flag its own sources (PLA-N-09)', () => {
  it('finds no detection in any source or test file', () => {
    const offenders: string[] = [];
    for (const file of listSources(SOURCE_DIR)) {
      const content = readFileSync(file, 'utf8');
      content.split('\n').forEach((line, index) => {
        const result = engine.scanLine(inputOf(line, { path: file, lineNumber: index + 1 }));
        for (const detection of result.detections) {
          offenders.push(`${file}:${index + 1} ${detection.rule}`);
        }
      });
      for (const detection of engine.scanPath(file).detections) {
        offenders.push(`${file} ${detection.rule}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps provider prefixes split in the signatures module', () => {
    const content = readFileSync(join(SOURCE_DIR, 'signatures.ts'), 'utf8');
    expect(content).toContain('sig(');
    // Aucun préfixe complet ne doit apparaître en un seul littéral.
    expect(content).not.toMatch(/'(?:AKIA|ASIA|ghp_|github_pat_|xox[bpoa]-|npm_|sk_live_|AIza)/);
  });
});
