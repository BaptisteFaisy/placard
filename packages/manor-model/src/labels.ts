import { familyLabel, findingAriaLabel, severityLabel, stateLabel } from '@placard/core';
import type { Finding, FindingFamily, SeverityLevel } from '@placard/core';

/**
 * Libellés textuels du manoir et du registre, en anglais (règle du concours).
 *
 * Aucune information n'est portée par la seule couleur (PLA-F-21) : chaque
 * porte, chaque ligne de registre et chaque trace d'empreintes reçoit ici une
 * phrase complète, lisible par un lecteur d'écran.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Accord simple du pluriel anglais. */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Date longue anglaise : « 11 March 2024 ». La chaîne brute si illisible. */
export function formatLongDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const date = new Date(ms);
  const month = MONTHS[date.getUTCMonth()] ?? '';
  return `${date.getUTCDate()} ${month} ${date.getUTCFullYear()}`.trim();
}

/** Durée lisible : « 12 days », « 14 months », « 2 years 3 months ». */
export function humanizeDays(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'less than a day';
  if (days < 31) return plural(Math.round(days), 'day');
  if (days < 365) return plural(Math.max(1, Math.round(days / 30.4375)), 'month');
  let years = Math.floor(days / 365.25);
  let months = Math.round((days - years * 365.25) / 30.4375);
  if (months >= 12) {
    years += 1;
    months = 0;
  }
  return months === 0 ? plural(years, 'year') : `${plural(years, 'year')} ${plural(months, 'month')}`;
}

export interface DoorLabelInput {
  shortCommit: string;
  date: string;
  findings: number;
  severity: SeverityLevel;
  ageDays: number;
  sealed: number;
  dismissed: number;
}

/**
 * Libellé accessible d'une porte :
 * « Door: commit 3ab91c0, 11 March 2024, 2 findings, highest severity critical, 3 years old ».
 */
export function doorAriaLabel(input: DoorLabelInput): string {
  const parts = [
    `Door: commit ${input.shortCommit}`,
    formatLongDate(input.date),
    plural(input.findings, 'finding'),
    `highest severity ${severityLabel(input.severity).toLowerCase()}`,
    `${humanizeDays(input.ageDays)} old`,
  ];
  if (input.sealed > 0) parts.push(`${input.sealed} sealed`);
  if (input.dismissed > 0) parts.push(`${input.dismissed} dismissed`);
  return parts.join(', ');
}

/** Libellé accessible d'une ligne de registre (mêmes données qu'une fiche). */
export function rowAriaLabel(finding: Finding, path: string, severity: SeverityLevel): string {
  const base = findingAriaLabel({
    preview: finding.preview,
    family: finding.family,
    danger: finding.danger,
    inHead: finding.inHead,
  });
  return [
    base,
    `rule ${finding.rule}`,
    path === '' ? 'no file path' : `path ${path}`,
    `introduced ${formatLongDate(finding.introduced.date)}`,
    `state ${stateLabel(finding.state).toLowerCase()}`,
    `severity ${severityLabel(severity).toLowerCase()}`,
    `danger ${finding.danger} out of 100`,
    plural(finding.locations.length, 'location'),
  ].join(', ');
}

export interface FootprintLabelInput {
  family: FindingFamily;
  preview: string;
  lifetimeDays: number;
  doors: number;
  floors: number;
}

/** Libellé accessible d'une trace : « lived 14 months across 11 doors on 2 floors ». */
export function footprintAriaLabel(input: FootprintLabelInput): string {
  const duration = humanizeDays(input.lifetimeDays);
  return (
    `Footprints of ${familyLabel(input.family).toLowerCase()}, ${input.preview}: ` +
    `lived ${duration} across ${plural(input.doors, 'door')} on ${plural(input.floors, 'floor')}`
  );
}

/** Étiquette d'un pan de mur : « 7 commits » (compressé, C.4). */
export function wallLabel(commits: number): string {
  return plural(commits, 'commit');
}
