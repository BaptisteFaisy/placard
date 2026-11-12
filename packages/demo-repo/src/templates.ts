/**
 * Fichiers modèles du dépôt hanté.
 *
 * Chaque modèle est un fichier plausible du dépôt synthétique : un en-tête
 * stable, un pied stable, et une zone centrale où le planificateur insère puis
 * retire les lignes plantées. Le `dialect` décide de la forme d'écriture d'une
 * valeur (`const X = '…'`, `X=…`, `X: …`, `- X: …`).
 *
 * Aucune valeur au format réel d'un secret n'apparaît ici (PLA-N-09) : les
 * valeurs viennent toutes de `fakeValue` de `@placard/core`, à l'exécution.
 */

/** Dialecte d'écriture d'un fichier modèle. */
export type Dialect = 'ts' | 'env' | 'yaml' | 'md';

/** Un fichier modèle : en-tête stable, pied stable, zone de plantation au milieu. */
export interface FileTemplate {
  dialect: Dialect;
  header: readonly string[];
  footer: readonly string[];
}

const CONFIG_TS: FileTemplate = {
  dialect: 'ts',
  header: [
    '// Application configuration. Values are read from the environment at boot',
    '// so that deployments never ship credentials inside the bundle.',
    'export interface AppConfig {',
    '  region: string;',
    '  timeoutMs: number;',
    '  retries: number;',
    '}',
    '',
    'export const baseConfig: AppConfig = {',
    "  region: process.env.AWS_REGION ?? 'eu-west-1',",
    '  timeoutMs: Number(process.env.TIMEOUT_MS ?? 5000),',
    '  retries: Number(process.env.RETRIES ?? 3),',
    '};',
    '',
    '// Deployment values read at boot.',
  ],
  footer: ['', 'export default baseConfig;'],
};

const STORAGE_TS: FileTemplate = {
  dialect: 'ts',
  header: [
    '// Object storage helpers used by the nightly archive job.',
    "import { baseConfig } from '../config';",
    '',
    'export interface UploadResult {',
    '  key: string;',
    '  bytes: number;',
    '}',
    '',
    'export async function uploadArchive(key: string, payload: Buffer): Promise<UploadResult> {',
    '  await Promise.resolve(baseConfig.region);',
    '  return { key, bytes: payload.byteLength };',
    '}',
    '',
    'const archivePrefix = `${baseConfig.region}/archive`;',
  ],
  footer: ['', 'export { archivePrefix };'],
};

const CONNECTION_TS: FileTemplate = {
  dialect: 'ts',
  header: [
    '// Database connection settings for the reporting service.',
    'export interface ConnectionOptions {',
    '  host: string;',
    '  port: number;',
    '  database: string;',
    '}',
    '',
    'export const connectionOptions: ConnectionOptions = {',
    "  host: process.env.DB_HOST ?? 'localhost',",
    '  port: Number(process.env.DB_PORT ?? 5432),',
    "  database: process.env.DB_NAME ?? 'reports',",
    '};',
    '',
  ],
  footer: ['', 'export default connectionOptions;'],
};

const BILLING_TS: FileTemplate = {
  dialect: 'ts',
  header: [
    '// Billing client kept for the legacy settlement job. Scheduled for removal',
    '// once the new provider migration is complete.',
    'export interface SettlementBatch {',
    '  reference: string;',
    '  amountCents: number;',
    '}',
    '',
    'export function settlementDelayDays(amountCents: number): number {',
    '  return amountCents > 100_000 ? 7 : 2;',
    '}',
    '',
    'const settlementCurrency = `EUR`;',
  ],
  footer: ['', 'export { settlementCurrency };'],
};

const PRODUCTION_ENV: FileTemplate = {
  dialect: 'env',
  header: [
    '# Production deployment overrides, consumed by scripts/deploy.sh.',
    'NODE_ENV=production',
    'LOG_LEVEL=info',
    'SERVICE_NAME=reports',
  ],
  footer: [''],
};

const SETTINGS_YAML: FileTemplate = {
  dialect: 'yaml',
  header: [
    '# Service settings, overridable per environment.',
    'service:',
    '  name: reports',
    '  replicas: 3',
    '  healthcheck: /healthz',
    'limits:',
    '  requestTimeoutMs: 5000',
  ],
  footer: [''],
};

const DEPLOY_SH: FileTemplate = {
  dialect: 'env',
  header: [
    '#!/usr/bin/env bash',
    '# Deployment entry point. Reads overrides from deploy/production.env.',
    'set -euo pipefail',
    '',
    'echo "deploying reports service"',
  ],
  footer: [''],
};

const CONFIG_TEST_TS: FileTemplate = {
  dialect: 'ts',
  header: [
    '// Tests for the configuration loader.',
    "import { describe, expect, it } from 'vitest';",
    '',
    "import { baseConfig } from '../src/config';",
    '',
    "describe('baseConfig', () => {",
    "  it('exposes a region', () => {",
    "    expect(typeof baseConfig.region).toBe('string');",
    '  });',
    '',
    "  it('defaults the timeout', () => {",
    '    expect(baseConfig.timeoutMs).toBeGreaterThan(0);',
    '  });',
  ],
  footer: ['});'],
};

const QUICKSTART_TS: FileTemplate = {
  dialect: 'ts',
  header: [
    '// Minimal example showing how the client is configured for a stage.',
    "import { baseConfig } from '../config';",
    '',
    'export function quickstart(): string {',
    '  return `running in ${baseConfig.region}`;',
    '}',
    '',
    'const exampleStage = `staging`;',
  ],
  footer: ['', 'export { exampleStage };'],
};

const SETUP_MD: FileTemplate = {
  dialect: 'md',
  header: [
    '# Setup',
    '',
    '1. Install dependencies with `pnpm install`.',
    '2. Copy the environment overrides for your target stage.',
    '3. Run the service locally with `pnpm dev`.',
    '',
    '## Configuration',
    '',
  ],
  footer: ['', 'See `deploy/` for the per-stage overrides.'],
};

const TEMPLATES: Record<string, FileTemplate> = {
  'src/config.ts': CONFIG_TS,
  'src/services/storage.ts': STORAGE_TS,
  'src/db/connection.ts': CONNECTION_TS,
  'src/legacy/billing.ts': BILLING_TS,
  'deploy/production.env': PRODUCTION_ENV,
  'config/settings.yml': SETTINGS_YAML,
  'scripts/deploy.sh': DEPLOY_SH,
  'tests/config.test.ts': CONFIG_TEST_TS,
  'examples/quickstart.ts': QUICKSTART_TS,
  'docs/setup.md': SETUP_MD,
};

/** Modèle d'un chemin, ou `undefined` si le chemin n'est pas un modèle. */
export function templateFor(path: string): FileTemplate | undefined {
  return TEMPLATES[path];
}

/** Tous les chemins modèles, dans un ordre stable. */
export function templatePaths(): string[] {
  return Object.keys(TEMPLATES).sort();
}

/**
 * Dialecte d'un chemin, ou `undefined` si le chemin n'est pas un modèle.
 *
 * Le dialecte décide de la forme d'écriture d'une valeur — et donc de la règle
 * que le moteur de détection lui appliquera.
 */
export function dialectOf(path: string): Dialect | undefined {
  return templateFor(path)?.dialect;
}
