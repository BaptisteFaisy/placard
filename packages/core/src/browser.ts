/**
 * Point d'entrée compatible navigateur de `@placard/core` (pour `@placard/web`).
 * Exporte toutes les primitives pures et le schéma Zod, sans les modules
 * Node-only (`node:crypto` dans `redact.ts` et `fake-values.ts`).
 */
export * from './types.js';
export * from './scoring.js';
export * from './severity.js';
export * from './i18n.js';
export * from './schema.js';
export * from './checksums.js';
export * from './contracts/git.js';
export * from './contracts/detector.js';
export * from './contracts/analysis.js';
export * from './contracts/demo.js';
export * from './contracts/ritual.js';
export * from './contracts/manor.js';
export * from './contracts/cli.js';

export const TOOL_NAME = 'placard';
export const TOOL_VERSION = '0.1.0';
export const REPORT_SCHEMA_VERSION = '1.0.0';
