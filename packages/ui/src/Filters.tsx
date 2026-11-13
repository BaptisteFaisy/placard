import React from 'react';
import { FAMILIES, SEVERITY_ORDER, familyLabel, stateLabel } from '@placard/core';
import type { FindingFilter, FindingState, SeverityLevel, FindingFamily } from '@placard/core';

import { SeverityMark } from './a11y/SeverityMark';

/**
 * Les filtres communs aux deux vues (PLA-F-19).
 *
 * Gravité, famille, état, présence dans HEAD, période et recherche texte. Le
 * composant ne filtre rien lui-même : il produit un `FindingFilter` que
 * `@placard/manor-model` applique **une seule fois** pour le manoir et le
 * registre (PLA-P-11).
 */

/** États proposés par l'interface, dans l'ordre du cycle de vie. */
export const FILTER_STATES: readonly FindingState[] = ['open', 'rotated', 'purged', 'sealed', 'ignored'];

/** Choix de présence dans le code courant. */
export type HeadChoice = 'all' | 'in' | 'out';

/** Lit la présence depuis un filtre (trois états, jamais un booléen ambigu). */
export function headChoiceOf(filter: FindingFilter): HeadChoice {
  if (filter.inHead === true) return 'in';
  if (filter.inHead === false) return 'out';
  return 'all';
}

/** Écrit la présence dans un filtre. */
export function withHeadChoice(filter: FindingFilter, choice: HeadChoice): FindingFilter {
  const next: FindingFilter = { ...filter };
  if (choice === 'all') delete next.inHead;
  else next.inHead = choice === 'in';
  return next;
}

/** Ajoute ou retire une valeur d'une liste de critères (jamais de doublon). */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export interface FiltersProps {
  filter: FindingFilter;
  onChange: (filter: FindingFilter) => void;
  /** Années disponibles dans le rapport, pour la période. */
  years: readonly number[];
  /** Nombre de trouvailles retenues, annoncé en direct. */
  matched: number;
}

/** Groupe de cases à cocher générique, avec son intitulé. */
function CheckGroup<T extends string>({
  legend,
  values,
  selected,
  labelOf,
  onToggle,
}: {
  legend: string;
  values: readonly T[];
  selected: readonly T[];
  labelOf: (value: T) => string;
  onToggle: (value: T) => void;
}): React.ReactElement {
  return (
    <fieldset className="placard-filters__group">
      <legend>{legend}</legend>
      {values.map((value) => (
        <label key={value} className="placard-filters__option">
          <input type="checkbox" checked={selected.includes(value)} onChange={() => onToggle(value)} value={value} />
          {labelOf(value)}
        </label>
      ))}
    </fieldset>
  );
}

/** Gravité : libellé + pictogramme, jamais la couleur seule. */
function SeverityGroup({ filter, onChange }: { filter: FindingFilter; onChange: (filter: FindingFilter) => void }): React.ReactElement {
  return (
    <fieldset className="placard-filters__group">
      <legend>Severity</legend>
      {SEVERITY_ORDER.map((severity: SeverityLevel) => (
        <label key={severity} className="placard-filters__option">
          <input
            type="checkbox"
            checked={filter.severities.includes(severity)}
            onChange={() => onChange({ ...filter, severities: toggle(filter.severities, severity) })}
            value={severity}
          />
          <SeverityMark severity={severity} />
        </label>
      ))}
    </fieldset>
  );
}

/** Présence dans HEAD et période. */
function PresenceGroup({ filter, onChange, years }: { filter: FindingFilter; onChange: (filter: FindingFilter) => void; years: readonly number[] }): React.ReactElement {
  const head = headChoiceOf(filter);
  const first = years[0];
  const last = years[years.length - 1];
  return (
    <fieldset className="placard-filters__group">
      <legend>Presence and period</legend>
      <label className="placard-filters__option">
        <select value={head} onChange={(event) => onChange(withHeadChoice(filter, event.target.value as HeadChoice))}>
          <option value="all">In and out of current code</option>
          <option value="in">Still in current code</option>
          <option value="out">Absent from current code</option>
        </select>
      </label>
      {first !== undefined && last !== undefined ? (
        <label className="placard-filters__option">
          From
          <input
            type="number"
            min={first}
            max={last}
            value={filter.fromYear ?? first}
            onChange={(event) => onChange({ ...filter, fromYear: Number(event.target.value) })}
            aria-label="From year"
          />
          to
          <input
            type="number"
            min={first}
            max={last}
            value={filter.toYear ?? last}
            onChange={(event) => onChange({ ...filter, toYear: Number(event.target.value) })}
            aria-label="To year"
          />
        </label>
      ) : null}
    </fieldset>
  );
}

/** Barre de filtres complète, partagée par le manoir et le registre. */
export function Filters({ filter, onChange, years, matched }: FiltersProps): React.ReactElement {
  return (
    <form className="placard-filters" aria-label="Filters" onSubmit={(event) => event.preventDefault()}>
      <label className="placard-filters__search">
        Search
        <input
          type="search"
          value={filter.query ?? ''}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
          placeholder="preview, path or rule"
        />
      </label>
      <SeverityGroup filter={filter} onChange={onChange} />
      <CheckGroup<FindingFamily>
        legend="Family"
        values={FAMILIES}
        selected={filter.families}
        labelOf={(family) => familyLabel(family)}
        onToggle={(family) => onChange({ ...filter, families: toggle(filter.families, family) })}
      />
      <CheckGroup<FindingState>
        legend="State"
        values={FILTER_STATES}
        selected={filter.states}
        labelOf={(state) => stateLabel(state)}
        onToggle={(state) => onChange({ ...filter, states: toggle(filter.states, state) })}
      />
      <PresenceGroup filter={filter} onChange={onChange} years={years} />
      <p className="placard-filters__count" role="status" aria-live="polite">
        {matched} finding{matched === 1 ? '' : 's'} match
      </p>
    </form>
  );
}
