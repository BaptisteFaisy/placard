import type { FindingFamily } from '@placard/core';

import type { Dialect, FileTemplate } from './templates.js';

/**
 * Mise en forme des lignes plantées.
 *
 * Une valeur plantée est écrite dans le dialecte du fichier hôte, de sorte que
 * le dépôt synthétique reste crédible à l'inspection. Les blocs multi-lignes
 * (clé privée) sont rendus **d'une seule pièce** afin que la valeur reste
 * contiguë dans le fichier : un `git show <sha>:<path>` la contient telle
 * quelle, ce dont l'oracle de test a besoin.
 */

/** Un bloc de lignes plantées, et l'indice de la ligne où commence la valeur. */
export interface PlantBlock {
  lines: string[];
  valueStartOffset: number;
}

/** Un bloc planté identifié, tel qu'il vit dans la zone de plantation d'un fichier. */
export interface PlantLine extends PlantBlock {
  id: string;
}

/**
 * Une valeur sur une ligne, dans le dialecte du fichier hôte.
 *
 * Les guillemets ne sont pas décoratifs : la règle « mot de passe en affectation »
 * de `@placard/detectors` n'accepte une valeur que **entre guillemets**. Une
 * valeur plantée sans eux ne serait jamais détectée, et l'oracle mentirait.
 */
function singleLine(value: string, key: string, dialect: Dialect): string {
  if (dialect === 'env') return `${key}=${value}`;
  if (dialect === 'yaml') return `${key}: '${value}'`;
  if (dialect === 'md') return `- ${key}: '${value}'`;
  return `const ${key} = '${value}';`;
}

function multiLine(value: string, key: string, dialect: Dialect): PlantBlock {
  const body = value.split('\n');
  if (dialect === 'ts') {
    return {
      lines: ['// Signing material kept for the legacy runner.', `const ${key} = \``, ...body, '`;'],
      valueStartOffset: 2,
    };
  }
  return { lines: [`# ${key}`, ...body], valueStartOffset: 1 };
}

/** Rend une valeur dans le dialecte d'un fichier, sous forme de bloc. */
export function formatPlant(
  family: FindingFamily,
  value: string,
  key: string,
  dialect: Dialect,
): PlantBlock {
  if (family === 'private-key') return multiLine(value, key, dialect);
  return { lines: [singleLine(value, key, dialect)], valueStartOffset: 0 };
}

/** Compose le contenu complet d'un fichier modèle : en-tête, zone plantée, pied. */
export function renderTemplate(template: FileTemplate, active: readonly PlantLine[]): string {
  const lines: string[] = [...template.header];
  for (const plant of active) lines.push(...plant.lines);
  lines.push(...template.footer);
  return `${lines.join('\n')}\n`;
}

/**
 * Numéro de ligne (1-based) où commence la valeur d'un bloc, si ce bloc était
 * ajouté maintenant à la fin de la zone de plantation existante.
 */
export function lineOf(
  template: FileTemplate,
  active: readonly PlantLine[],
  block: PlantBlock,
): number {
  let offset = template.header.length;
  for (const plant of active) offset += plant.lines.length;
  return offset + block.valueStartOffset + 1;
}
