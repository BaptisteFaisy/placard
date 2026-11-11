export * from './types.js';
export * from './redact.js';
export * from './scoring.js';
export * from './severity.js';
export * from './i18n.js';
export * from './schema.js';
export * from './contracts/git.js';
export * from './contracts/detector.js';
export * from './contracts/analysis.js';
export * from './contracts/demo.js';
export * from './contracts/ritual.js';
export * from './contracts/manor.js';
export * from './contracts/cli.js';

/** Version de l'outil, lue depuis le paquet racine. */
export const TOOL_NAME = 'placard';
export const TOOL_VERSION = '0.1.0';
/** Version du schéma de rapport : toute rupture de format l'incrémente. */
export const REPORT_SCHEMA_VERSION = '1.0.0';
