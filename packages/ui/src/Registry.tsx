import React from 'react';
import { familyLabel, stateLabel } from '@placard/core';
import type { Finding, ManorViewModel, RegistryRow, RegistrySort, RegistrySortField } from '@placard/core';
import { REGISTRY_SORT_FIELDS, buildRegistryRows, plural } from '@placard/manor-model';

import { SeverityMark } from './a11y/SeverityMark';
import { lifetimeDaysOf } from './sheet-data';

/**
 * Le registre sur le guéridon (PLA-F-18) : la vue tableau équivalente du
 * manoir, pour qui préfère — ou a besoin de — lire les données en lignes.
 *
 * Mêmes données, même filtre, même ensemble : les lignes viennent de
 * `registryRows(model, sort)` du modèle partagé, jamais d'un recalcul local.
 * Tri accessible (`aria-sort`), lignes au clavier, chaque ligne porte son
 * `ariaLabel` complet.
 */

/** Libellé anglais d'un champ de tri. */
export const SORT_LABELS: Record<RegistrySortField, string> = {
  danger: 'Danger',
  date: 'Date',
  family: 'Family',
  path: 'Path',
  state: 'State',
};

/** Sens de tri accessible pour `aria-sort`. */
export function ariaSortFor(field: RegistrySortField, sort: RegistrySort): 'ascending' | 'descending' | 'none' {
  if (sort.field !== field) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

export interface RegistryProps {
  model: ManorViewModel;
  sort: RegistrySort;
  onSortChange: (sort: RegistrySort) => void;
  onSelect: (finding: Finding) => void;
  /** Trouvaille ouverte dans la fiche, pour la mise en évidence. */
  selectedId?: string;
  /** Date de référence pour la durée de vie. */
  now?: Date;
}

/** En-tête triable : un bouton dans un `th` porteur d'`aria-sort`. */
function SortHeader({
  field,
  sort,
  onSortChange,
}: {
  field: RegistrySortField;
  sort: RegistrySort;
  onSortChange: (sort: RegistrySort) => void;
}): React.ReactElement {
  const active = sort.field === field;
  const next: RegistrySort = { field, direction: active && sort.direction === 'desc' ? 'asc' : 'desc' };
  return (
    <th scope="col" aria-sort={ariaSortFor(field, sort)}>
      <button type="button" className="placard-registry__sort" onClick={() => onSortChange(next)}>
        {SORT_LABELS[field]}
        <span aria-hidden="true">{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}</span>
      </button>
    </th>
  );
}

/** Une ligne de registre : ouverte au clic et au clavier (Entrée ou Espace). */
function RegistryRowView({
  row,
  selected,
  onSelect,
  now,
}: {
  row: RegistryRow;
  selected: boolean;
  onSelect: (finding: Finding) => void;
  now: Date;
}): React.ReactElement {
  const finding = row.finding;
  const open = (): void => onSelect(finding);
  return (
    <tr
      className={`placard-registry__row${selected ? ' placard-registry__row--selected' : ''}`}
      aria-label={row.ariaLabel}
      aria-current={selected ? 'true' : undefined}
      tabIndex={0}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
      data-finding={finding.id}
    >
      <td>
        <SeverityMark severity={row.severity} />
      </td>
      <td>{finding.danger}</td>
      <td>{familyLabel(finding.family)}</td>
      <td>
        <code>{row.path === '' ? 'no file path' : row.path}</code>
      </td>
      <td>{stateLabel(finding.state)}</td>
      <td>{finding.inHead ? 'in current code' : 'absent from current code'}</td>
      <td>{lifetimeDaysOf(finding, now)} days</td>
      <td>
        <code>{finding.preview}</code>
      </td>
    </tr>
  );
}

/** Le registre complet : tableau triable, filtrable, navigable. */
export function Registry({ model, sort, onSortChange, onSelect, selectedId, now }: RegistryProps): React.ReactElement {
  const rows = buildRegistryRows(model, sort);
  const reference = now ?? new Date();
  return (
    <div className="placard-registry">
      <table className="placard-registry__table">
        <caption className="placard-registry__caption">
          Registry — {plural(rows.length, 'finding')}, the same set as the manor
        </caption>
        <thead>
          <tr>
            {REGISTRY_SORT_FIELDS.map((field) => (
              <SortHeader key={field} field={field} sort={sort} onSortChange={onSortChange} />
            ))}
            <th scope="col">Presence</th>
            <th scope="col">Lifetime</th>
            <th scope="col">Preview</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RegistryRowView
              key={row.finding.id}
              row={row}
              selected={row.finding.id === selectedId}
              onSelect={onSelect}
              now={reference}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
