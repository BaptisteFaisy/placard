// @placard/cli — commandes scan, serve, ritual, demo, selftest (contrat cli.ts).

export { createCliApi, cli } from './wire.js';
export { collectHistory } from './collect.js';
export type { AnchoredDetection, CollectOutcome } from './collect.js';
export { scanCommand, reportPathOf } from './scan.js';
export { repoSalt, rootCommit } from './salt.js';
export { buildHeadPresence } from './head-presence.js';
export { parseArgs, type ParsedArgs } from './args.js';
export { resolvePlacardDir, resolveReportPath, defaultReportPath } from './paths.js';
export { ProgressDisplay } from './progress.js';
export { renderSummary, renderJsonLine, toResultJson } from './output.js';
export { createReportServer, startReportServer } from './server.js';
export type {
  CliApi,
  CliCommandName,
  CliErrorCode,
  CliEvent,
  CliResult,
  DemoOptions,
  RitualCliOptions,
  ScanOptions,
  ServeOptions,
} from '@placard/core';
