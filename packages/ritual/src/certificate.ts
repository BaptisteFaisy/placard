import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  CertificateInput,
  CertificateResult,
  PlacardReport,
  RitualOptions,
} from '@placard/core';

import { readReport } from './verify';

/**
 * Certificat (PLA-F-28) : `PLACARD.md` et son badge SVG.
 *
 * Aucun secret, jamais : seuls des compteurs, des dates, un identifiant de
 * commit et des limites assumées.
 */

export const CERTIFICATE_FILE = 'PLACARD.md';
export const BADGE_FILE = 'placard-badge.svg';

const SEALED_COLOR = '#7C6DB8';
const OPEN_COLOR = '#E4572E';
const BADGE_BG = '#2B2233';

/** Ce que le certificat ne couvre pas — la partie honnête du document. */
export const NOT_COVERED: readonly string[] = [
  'It does not prove that the credential was rotated. Step 1 only records your attestation; Placard never checks the provider for you.',
  'It covers only the history reachable from the refs of this repository at analysis time — not forks, pull-request refs, wikis, issues, CI logs or host caches.',
  'It does not cover copies elsewhere: other repositories, build artifacts, package registries, backups, and the clones your collaborators already have.',
  'It does not cover personal data held outside this repository, and it is not a legal or compliance attestation.',
  'A purged history deactivates nothing: a value that was never rotated stays valid even after the purge.',
];

async function tryReadReport(path: string): Promise<PlacardReport | undefined> {
  try {
    return await readReport(path);
  } catch {
    return undefined;
  }
}

function row(label: string, value: string): string {
  return `| ${label} | ${value} |`;
}

function metaRows(report: PlacardReport | undefined, options: RitualOptions): string[] {
  return [
    row('Repository', report?.repo.name ?? 'unavailable'),
    row('Analyzed commit', report?.repo.head ?? 'unavailable'),
    row('Analyzed at', report?.repo.analyzedAt ?? 'unavailable'),
    row('Tool', `placard ${options.toolVersion}`),
  ];
}

/** Construit le corps Markdown du certificat. */
export function buildCertificateMarkdown(
  options: RitualOptions,
  input: CertificateInput,
  report: PlacardReport | undefined,
  issuedAt: string,
): string {
  const sealed = input.open === 0;
  const lines = [
    '# Placard certificate',
    '',
    '> This repository was searched for forgotten secrets and personal data.',
    '> The remediation ritual was recorded step by step, in the imposed order.',
    '',
    '| Field | Value |',
    '| --- | --- |',
    row('Issued', issuedAt),
    ...metaRows(report, options),
    row('Findings treated', String(input.treated)),
    row('Findings dismissed', String(input.dismissed)),
    row('Findings still open', String(input.open)),
    row('Status', sealed ? 'sealed' : 'open'),
    '',
    '## What this certificate does not cover',
    '',
    ...NOT_COVERED.map((item) => `- ${item}`),
    '',
  ];
  return lines.join('\n');
}

/** Badge SVG autonome (aucune ressource distante). */
export function buildBadgeSvg(input: CertificateInput): string {
  const sealed = input.open === 0;
  const label = 'placard';
  const status = sealed ? 'sealed' : `${String(input.open)} open`;
  const color = sealed ? SEALED_COLOR : OPEN_COLOR;
  const width = 200;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${status}">
  <title>${label}: ${status}</title>
  <rect width="${width}" height="20" rx="3" fill="${BADGE_BG}"/>
  <rect x="70" width="${width - 70}" height="20" rx="3" fill="${color}"/>
  <g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="10" y="14">${label}</text>
    <text x="80" y="14">${status}</text>
  </g>
</svg>
`;
}

/** Écrit `PLACARD.md` et le badge SVG dans le dossier `.placard`. */
export async function certificate(
  options: RitualOptions,
  input: CertificateInput,
): Promise<CertificateResult> {
  const report = await tryReadReport(input.reportPath);
  const issuedAt = new Date().toISOString();
  const markdown = buildCertificateMarkdown(options, input, report, issuedAt);
  const badgeSvg = buildBadgeSvg(input);
  await mkdir(options.placardDir, { recursive: true });
  const markdownPath = join(options.placardDir, CERTIFICATE_FILE);
  const badgeSvgPath = join(options.placardDir, BADGE_FILE);
  await writeFile(markdownPath, markdown, 'utf8');
  await writeFile(badgeSvgPath, badgeSvg, 'utf8');
  return { markdownPath, badgeSvgPath, markdown, badgeSvg };
}
