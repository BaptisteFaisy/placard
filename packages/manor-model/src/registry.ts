import { familyLabel, severityOf, stateLabel } from '@placard/core';
import type {
  Finding,
  ManorViewModel,
  RegistryRow,
  RegistrySort,
  RegistrySortField,
} from '@placard/core';

import { timeOf } from './dates.js';
import { rowAriaLabel } from './labels.js';

/**
 * Le registre sur le guéridon (PLA-F-18, PLA-F-19).
 *
 * Les lignes sont construites depuis `model.findings` — l'ensemble déjà filtré
 * par `applyFilters` — ce qui garantit PLA-P-11 : le registre et le manoir
 * exposent exactement les mêmes trouvailles, triées selon la demande.
 */

/** Champs de tri proposés par le registre, dans l'ordre d'affichage. */
export const REGISTRY_SORT_FIELDS: readonly RegistrySortField[] = [
  'danger',
  'date',
  'family',
  'path',
  'state',
];

/** Une ligne de registre : mêmes données qu'une fiche du manoir. */
export function buildRegistryRow(finding: Finding): RegistryRow {
  const severity = severityOf(finding.danger);
  const path = finding.locations[0]?.path ?? '';
  return { finding, severity, path, ariaLabel: rowAriaLabel(finding, path, severity) };
}

/** Comparateurs par champ de tri. */
const COMPARATORS: Record<RegistrySortField, (a: RegistryRow, b: RegistryRow) => number> = {
  danger: (a, b) => a.finding.danger - b.finding.danger,
  date: (a, b) => timeOf(a.finding.introduced.date) - timeOf(b.finding.introduced.date),
  family: (a, b) => familyLabel(a.finding.family).localeCompare(familyLabel(b.finding.family)),
  path: (a, b) => a.path.localeCompare(b.path),
  state: (a, b) => stateLabel(a.finding.state).localeCompare(stateLabel(b.finding.state)),
};

/**
 * Lignes du registre, triées. Le tri secondaire (identifiant) reste croissant
 * dans les deux sens : le résultat est totalement déterministe.
 */
export function buildRegistryRows(model: ManorViewModel, sort: RegistrySort): RegistryRow[] {
  const rows = model.findings.map(buildRegistryRow);
  const compare = COMPARATORS[sort.field];
  const sign = sort.direction === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const primary = compare(a, b) * sign;
    return primary !== 0 ? primary : a.finding.id.localeCompare(b.finding.id);
  });
  return rows;
}
