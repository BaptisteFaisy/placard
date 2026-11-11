import { resolve } from 'node:path';
import { type CliApi, type CliResult, type DemoOptions, type RitualCliOptions, type ServeOptions } from '@placard/core';
import { generate } from '@placard/demo-repo';
import { createRitualApi } from '@placard/ritual';
import { startReportServer } from './server.js';
import { scanCommand } from './scan.js';
import { parseArgs } from './args.js';

/** Commande `serve` (PLA-F-30) : serveur local sur 127.0.0.1, sans réseau sortant. */
async function serveCommand(options: ServeOptions): Promise<CliResult> {
  const reportPath = resolve(options.report ?? '.placard/report.json');
  try {
    const handle = await startReportServer(reportPath, options.port ?? 0);
    return { exitCode: 0, url: handle.url, reportPath };
  } catch {
    return { exitCode: 3, errorCode: 'report-missing' };
  }
}

/** Commande `demo` (PLA-F-13) : dépôt synthétique, analyse, rapport écrit. */
async function demoCommand(options: DemoOptions): Promise<CliResult> {
  const targetDir = resolve(options.targetDir ?? '.placard/demo-repo');
  await generate({ targetDir, seed: options.seed ?? 'placard-demo' });
  const scanned = await scanCommand({ repoDir: targetDir });
  return { exitCode: 0, reportPath: scanned.reportPath };
}

/** Commande `ritual` : le métier est dans `@placard/ritual`, la CLI ne fait qu'appeler. */
async function ritualCommand(options: RitualCliOptions): Promise<CliResult> {
  const ritual = createRitualApi();
  const repoDir = resolve(options.repoDir);
  const placardDir = resolve(repoDir, '.placard');
  const tmpDir = '/tmp/placard-ritual';
  if (options.action === 'prevent') {
    const proposal = await ritual.prevention({ repoDir, placardDir, tmpDir, toolVersion: '0.1.0' });
    process.stdout.write(`Suggested gitignore lines:\n${proposal.gitignoreLines.join('\n')}\n`);
    return { exitCode: 0 };
  }
  return { exitCode: 0 };
}

/** Commande `selftest` : analyse du dépôt courant (hook `self-scan`). */
async function selftestCommand(): Promise<CliResult> {
  return scanCommand({ repoDir: process.cwd(), failOnOpen: false });
}

/** Exécute la commande demandée et rend son résultat. */
async function dispatch(command: string | undefined, parsed: ReturnType<typeof parseArgs>): Promise<CliResult> {
  switch (command) {
    case 'scan':
      return scanCommand({
        repoDir: parsed.positional[0] ?? '.',
        report: parsed.values['report'] ?? parsed.values['out'],
        staged: parsed.flags['staged'],
        failOnOpen: parsed.flags['fail-on-open'],
        format: parsed.flags['json'] ? 'json' : 'summary',
      });
    case 'serve': {
      const portValue = parsed.values['port'];
      const result = await serveCommand({
        report: parsed.positional[0],
        port: portValue ? Number(portValue) : undefined,
      });
      if (result.url) console.log(`🏚️ Manor served at ${result.url}`);
      return result;
    }
    case 'demo':
      return demoCommand({ seed: parsed.values['seed'] });
    case 'selftest':
      return selftestCommand();
    case 'ritual':
      return ritualCommand({
        repoDir: '.',
        action: (parsed.positional[0] ?? 'status') as RitualCliOptions['action'],
      });
    default:
      return { exitCode: 0 };
  }
}

/** Racine de composition : la CLI ne fait que câbler les commandes. */
export function createCliApi(): CliApi {
  return {
    scan: scanCommand,
    serve: serveCommand,
    demo: demoCommand,
    ritual: ritualCommand,
    selftest: selftestCommand,
    async main(argv: readonly string[]): Promise<number> {
      const parsed = parseArgs(argv);
      const result = await dispatch(parsed.command, parsed);
      return result.exitCode;
    },
  };
}

export const cli = createCliApi();
