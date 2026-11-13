import type { Rand } from '@placard/core';

/**
 * Bruit réaliste du dépôt hanté.
 *
 * Le dépôt synthétique doit contenir des dizaines de commits **sans aucun
 * secret** (PLA-P-12), un fichier binaire et un fichier volumineux (pour
 * exercer les compteurs `skipped` de l'analyse). Tout ce qui est produit ici
 * est du code et de la documentation plausibles : aucune valeur au format réel
 * d'un secret, aucun jeton à haute entropie (PLA-N-09).
 */

/** Contenu d'un fichier du dépôt : texte ou octets bruts. */
export type FileContent = string | Buffer;

/** Une opération de bruit appliquée à un commit. */
export interface NoiseOp {
  /** Message de commit, en anglais. */
  message: string;
  /** `module` remplace le fichier, `append` ajoute des lignes à la fin. */
  kind: 'module' | 'append';
  path: string;
  lines: string[];
}

/** Chemin du fichier binaire (un PNG minimal d'une soixantaine d'octets). */
export const BINARY_ASSET_PATH = 'assets/logo.png';

/** Chemin du fichier volumineux (> 1 Mio), ignoré par l'analyse. */
export const LARGE_ASSET_PATH = 'data/fixtures-large.log';

const BINARY_ASSET_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Octets du PNG minimal, décodés à l'exécution. */
export function binaryAsset(): Buffer {
  return Buffer.from(BINARY_ASSET_BASE64, 'base64');
}

let cachedLarge: string | undefined;

/** Contenu du fichier volumineux, construit une fois puis réutilisé. */
export function largeAsset(): string {
  cachedLarge ??= buildLarge();
  return cachedLarge;
}

function buildLarge(): string {
  const lines: string[] = ['# generated fixture, do not edit'];
  for (let index = 0; index < 20_000; index += 1) {
    lines.push(`2024-01-01T00:00:00Z INFO fixture-record index=${index} status=ok`);
  }
  return `${lines.join('\n')}\n`;
}

const README_LINES: readonly string[] = [
  '# reports-service',
  '',
  'Internal reporting service: collects daily aggregates, stores them in object',
  'storage and exposes them through a small HTTP API.',
  '',
  '## Development',
  '',
  '```bash',
  'pnpm install',
  'pnpm dev',
  '```',
  '',
  '## Layout',
  '',
  '- `src/api.ts` — HTTP route table',
  '- `src/modules/` — feature modules',
  '- `deploy/` — per-environment overrides',
  '',
];

const PACKAGE_JSON = `${JSON.stringify(
  {
    name: 'reports-service',
    version: '0.3.0',
    private: true,
    type: 'module',
    scripts: { dev: 'node src/index.ts', test: 'vitest run' },
    dependencies: { undici: '6.19.8' },
  },
  null,
  2,
)}\n`;

const GITIGNORE_LINES: readonly string[] = ['node_modules/', 'dist/', 'coverage/', '.DS_Store', ''];

const INDEX_TS_LINES: readonly string[] = [
  '// Service entry point.',
  "import { routes } from './api';",
  '',
  'export function main(): string {',
  '  return `reports-service with ${routes.length} routes`;',
  '}',
  '',
];

const API_TS_LINES: readonly string[] = [
  '// HTTP route table. Feature modules register their handlers at import time.',
  'export interface Route {',
  "  method: 'GET' | 'POST';",
  '  path: string;',
  '  handler: string;',
  '}',
  '',
  'export const routes: Route[] = [];',
  '',
  'export function register(route: Route): void {',
  '  routes.push(route);',
  '}',
  '',
];

const CHANGELOG_LINES: readonly string[] = [
  '# Changelog',
  '',
  'All notable changes to the reporting service.',
  '',
];

/** Fichiers présents dès le commit initial. */
export function baseFiles(): Map<string, FileContent> {
  const files = new Map<string, FileContent>();
  files.set('README.md', `${README_LINES.join('\n')}`);
  files.set('package.json', PACKAGE_JSON);
  files.set('.gitignore', `${GITIGNORE_LINES.join('\n')}`);
  files.set('src/index.ts', `${INDEX_TS_LINES.join('\n')}`);
  files.set('src/api.ts', `${API_TS_LINES.join('\n')}`);
  files.set('CHANGELOG.md', `${CHANGELOG_LINES.join('\n')}`);
  return files;
}

const FEATURES: readonly string[] = [
  'billing',
  'archive',
  'search',
  'notifications',
  'reporting',
  'webhooks',
  'audit',
  'cache',
  'export',
  'insights',
  'tenants',
  'schedules',
];

const VERBS: readonly string[] = [
  'Add',
  'Refine',
  'Fix',
  'Document',
  'Split',
  'Rename',
  'Extend',
  'Harden',
];

function pickFrom(list: readonly string[], rand: Rand): string {
  const index = Math.min(list.length - 1, Math.floor(rand() * list.length));
  return list[index] ?? list[0] ?? '';
}

function pascal(feature: string): string {
  return feature.charAt(0).toUpperCase() + feature.slice(1);
}

function moduleLines(feature: string, version: number): string[] {
  const name = pascal(feature);
  return [
    `// ${name} feature module.`,
    `export const ${feature}Version = ${version};`,
    '',
    `export interface ${name}Record {`,
    '  id: string;',
    '  createdAt: string;',
    '}',
    '',
    `export function list${name}(records: readonly ${name}Record[]): ${name}Record[] {`,
    '  return [...records].sort((left, right) => left.id.localeCompare(right.id));',
    '}',
  ];
}

function changelogOp(date: Date, feature: string, verb: string): NoiseOp {
  const day = date.toISOString().slice(0, 10);
  return {
    message: `${verb.toLowerCase()} ${feature} handling`,
    kind: 'append',
    path: 'CHANGELOG.md',
    lines: [`- ${day}: ${verb} ${feature} handling`],
  };
}

function moduleOp(feature: string, verb: string, versions: Map<string, number>): NoiseOp {
  const version = (versions.get(feature) ?? 0) + 1;
  versions.set(feature, version);
  return {
    message: `${verb.toLowerCase()} ${feature} module`,
    kind: 'module',
    path: `src/modules/${feature}.ts`,
    lines: moduleLines(feature, version),
  };
}

function routeOp(feature: string): NoiseOp {
  const name = pascal(feature);
  return {
    message: `expose ${feature} route`,
    kind: 'append',
    path: 'src/api.ts',
    lines: [`register({ method: 'GET', path: '/${feature}', handler: 'list${name}' });`],
  };
}

/** État d'un plan de bruit : versions de modules et routes déjà exposées. */
interface NoiseState {
  versions: Map<string, number>;
  routes: Set<string>;
}

function noiseOpAt(index: number, date: Date, rand: Rand, state: NoiseState): NoiseOp {
  const feature = pickFrom(FEATURES, rand);
  const verb = pickFrom(VERBS, rand);
  const kind = index % 3;
  if (kind === 0) return changelogOp(date, feature, verb);
  // Une route n'est exposée qu'une fois : au-delà, le commit retouche le module.
  if (kind === 2 && !state.routes.has(feature)) {
    state.routes.add(feature);
    return routeOp(feature);
  }
  return moduleOp(feature, verb, state.versions);
}

/** Planifie une opération de bruit par commit (aucune pour le commit initial). */
export function planNoise(total: number, dates: readonly Date[], rand: Rand): NoiseOp[][] {
  const ops: NoiseOp[][] = [];
  const state: NoiseState = { versions: new Map(), routes: new Set() };
  for (let index = 0; index < total; index += 1) {
    if (index === 0) {
      ops.push([]);
      continue;
    }
    ops.push([noiseOpAt(index, dates[index] ?? new Date(0), rand, state)]);
  }
  return ops;
}

/** Applique une opération de bruit à l'arbre en mémoire. */
export function applyNoise(files: Map<string, FileContent>, op: NoiseOp): void {
  const body = `${op.lines.join('\n')}\n`;
  if (op.kind === 'module') {
    files.set(op.path, body);
    return;
  }
  const existing = files.get(op.path);
  const current = typeof existing === 'string' ? existing : '';
  files.set(op.path, `${current}${body}`);
}
