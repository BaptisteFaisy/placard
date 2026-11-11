import React from 'react';

import {
  FAMILY_TO_SKELETON,
  SEVERITY_COLORS,
  SEVERITY_GLYPHS,
  familyLabel,
  skeletonLabel,
  severityLabel,
} from '@placard/core';

import { SeverityMark } from './a11y/SeverityMark.js';
import { Skeleton } from './illustrations/Skeleton.js';
import { SpiderWeb } from './illustrations/SpiderWeb.js';

/**
 * La légende (PLA-F-15) : la table de correspondance costume ↔ données, rendue
 * accessible depuis n'importe quel écran.
 *
 * C'est le document qui rend le costume honnête : chaque élément du décor y est
 * relié à la donnée qu'il code, sans exception. Une légende absente ferait du
 * manoir un simple dessin.
 */


/** Une ligne de la table C.4. */
export interface LegendEntry {
  /** Élément du décor. */
  element: string;
  /** Donnée codée. */
  data: string;
}

/** La table C.4, dans l'ordre du steering `costume-mapping.md`. */
export const COSTUME_LEGEND: readonly LegendEntry[] = [
  { element: 'A floor', data: 'One year of history (attic = oldest year, ground floor = current year).' },
  { element: 'The corridor, left to right', data: 'Time, in chronological commit order within the year.' },
  { element: 'A door', data: 'A commit that contains at least one finding.' },
  { element: 'A wall labelled “N commits”', data: 'A run of commits with no finding at all, compressed.' },
  { element: 'Cobwebs on a door', data: 'Age of the commit (more cobwebs = older commit).' },
  {
    element: 'Light under the door',
    data: 'Highest severity behind the door (red critical, orange high, pale medium, violet low).',
  },
  { element: 'Skeleton type', data: 'Detected family: key bearer, paper bearer, chest, loose bones.' },
  { element: 'Skeleton size', data: 'Danger score, from 0 to 100.' },
  { element: 'Bone footprints', data: 'Lifetime of one secret, linking its introduction door to its removal doors.' },
  { element: 'A skeleton standing in the hall', data: 'Secret still present in current code (HEAD).' },
  { element: 'An open window in the corridor', data: 'The repository has a public remote (real exposure).' },
  { element: 'A red wax seal on a door', data: 'Finding handled (rotation done and purge validated).' },
  { element: 'A knotted ribbon on a door', data: 'False positive dismissed with a stated reason.' },
  { element: 'The lantern', data: 'The focus: follows the pointer or keyboard and lights the active finding.' },
  { element: 'The registry on the side table', data: 'Accessible table view (AA) holding exactly the same data.' },
];

/** Familles du costume, pour la section « skeletons ». */
const LEGEND_FAMILIES = [
  'cloud-key',
  'platform-token',
  'private-key',
  'signed-token',
  'plaintext-password',
  'bank-data',
  'identity',
  'risky-file',
  'suspicious-string',
] as const;

const LEGEND_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

export interface LegendProps {
  /** Panneau affiché ? */
  open: boolean;
  onClose: () => void;
}

/** Section « squelettes » : famille → type de figure. */
function SkeletonLegend(): React.ReactElement {
  return (
    <ul className="placard-legend__skeletons">
      {LEGEND_FAMILIES.map((family) => (
        <li key={family} className="placard-legend__skeleton">
          <svg viewBox="0 0 40 56" width="32" height="44" aria-hidden="true">
            <Skeleton family={family} danger={60} severity="medium" scale={1} />
          </svg>
          <span>
            <strong>{skeletonLabel(FAMILY_TO_SKELETON[family])}</strong> — {familyLabel(family)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Section « gravités » : couleur, pictogramme et libellé, jamais la couleur seule. */
function SeverityLegend(): React.ReactElement {
  return (
    <ul className="placard-legend__severities">
      {LEGEND_SEVERITIES.map((severity) => (
        <li key={severity}>
          <SeverityMark severity={severity} />
          <span className="placard-legend__swatch" style={{ background: SEVERITY_COLORS[severity] }} aria-hidden="true">
            {SEVERITY_GLYPHS[severity]}
          </span>
          <span className="placard-legend__text">{severityLabel(severity)} light under the door</span>
        </li>
      ))}
    </ul>
  );
}

/** Échantillon de toiles : 1 brin (récent) à 5 brins (ancien). */
function SpiderWebSamples(): React.ReactElement {
  return (
    <span className="placard-legend__webs">
      <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
        <SpiderWeb ageDays={0} radius={30} />
      </svg>
      <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
        <SpiderWeb ageDays={1400} radius={30} />
      </svg>
      Few cobwebs = recent commit; many cobwebs = old commit.
    </span>
  );
}

/** La légende complète, en panneau refermable. */
export function Legend({ open, onClose }: LegendProps): React.ReactElement | null {
  if (!open) return null;
  return (
    <section className="placard-legend" role="dialog" aria-modal="false" aria-label="Costume legend">
      <header className="placard-legend__head">
        <h2>What the manor means</h2>
        <button type="button" onClick={onClose}>
          Close legend
        </button>
      </header>
      <table className="placard-legend__table">
        <caption>Each decoration codes a real property of a finding.</caption>
        <thead>
          <tr>
            <th scope="col">Element</th>
            <th scope="col">Data it codes</th>
          </tr>
        </thead>
        <tbody>
          {COSTUME_LEGEND.map((entry) => (
            <tr key={entry.element}>
              <th scope="row">{entry.element}</th>
              <td>{entry.data}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Skeletons</h3>
      <SkeletonLegend />
      <h3>Severities</h3>
      <SeverityLegend />
      <p className="placard-legend__note">
        <SpiderWebSamples />
      </p>
    </section>
  );
}

export interface LegendToggleProps {
  /** Le panneau est-il ouvert ? */
  open: boolean;
  onToggle: () => void;
}

/**
 * Bouton d'accès à la légende, à poser sur n'importe quel écran : la légende
 * doit être atteignable même quand on regarde le registre ou le rituel.
 */
export function LegendToggle({ open, onToggle }: LegendToggleProps): React.ReactElement {
  return (
    <button type="button" className="placard-legend-toggle" onClick={onToggle} aria-expanded={open}>
      {open ? 'Close the legend' : 'What does the manor mean?'}
    </button>
  );
}
