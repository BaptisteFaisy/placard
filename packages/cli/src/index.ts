// @placard/cli — commandes scan, serve, ritual, demo, selftest (contrat cli.ts).

export { createCliApi, cli } from './wire';
export { collectHistory } from './collect';
export type { AnchoredDetection, CollectOutcome } from './collect';
export { scanCommand, reportPathOf } from './scan';
export { repoSalt, rootCommit } from './salt';
export { buildHeadPresence } from './head-presence';
export { parseArgs, type ParsedArgs } from './args';
export { resolvePlacardDir, resolveReportPath, defaultReportPath } from './paths';
export { ProgressDisplay } from './progress';
export { renderSummary, renderJsonLine, toResultJson } from './output';
export { createReportServer, startReportServer } from './server';
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
