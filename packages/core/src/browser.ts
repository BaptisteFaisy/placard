/**
 * Point d'entrée compatible navigateur de `@placard/core` (pour `@placard/web`).
 * Exporte toutes les primitives pures et le schéma Zod, sans les modules
 * Node-only (`node:crypto` dans `redact.ts` et `fake-values.ts`).
 */
export * from './types';
export * from './scoring';
export * from './severity';
export * from './i18n';
export * from './schema';
export * from './checksums';
export * from './contracts/git';
export * from './contracts/detector';
export * from './contracts/analysis';
export * from './contracts/demo';
export * from './contracts/ritual';
export * from './contracts/manor';
export * from './contracts/cli';

export const TOOL_NAME = 'placard';
export const TOOL_VERSION = '0.1.0';
export const REPORT_SCHEMA_VERSION = '1.0.0';
