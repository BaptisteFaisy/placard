export * from './types';
export * from './redact';
export * from './scoring';
export * from './severity';
export * from './i18n';
export * from './schema';
export * from './checksums';
export * from './fake-values';
export * from './contracts/git';
export * from './contracts/detector';
export * from './contracts/analysis';
export * from './contracts/demo';
export * from './contracts/ritual';
export * from './contracts/manor';
export * from './contracts/cli';

/** Version de l'outil, lue depuis le paquet racine. */
export const TOOL_NAME = 'placard';
export const TOOL_VERSION = '0.1.0';
/** Version du schéma de rapport : toute rupture de format l'incrémente. */
export const REPORT_SCHEMA_VERSION = '1.0.0';
