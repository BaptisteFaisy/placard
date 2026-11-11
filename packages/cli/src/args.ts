import type { CliCommandName } from '@placard/core';

/**
 * Découpage des arguments (PLA-F-30, usage propre) : parseur maison, sans
 * dépendance. Une erreur de forme produit un message d'usage en anglais et
 * l'appelant répondra avec le code de sortie 2 (`error-usage`).
 */

export const CLI_USAGE = [
  'Usage: placard <command> [options]',
  '',
  'Commands:',
  '  scan [repoDir]      Scan a Git repository for forgotten secrets and personal data',
  '  serve [report.json] Serve the local web app for an existing report',
  '  ritual <action>     Remediation ritual: status | rotate | purge | prevent | verify | certificate',
  '  demo [--seed s]     Generate a haunted demo repository, scan it, optionally serve it',
  '  selftest            Scan the current repository and print the verdict',
  '',
  'Options:',
  '  --out, --report <path>   Report file (default: .placard/report.json)',
  '  --staged                 Scan only the staged changes (pre-commit mode)',
  '  --json                   JSON output on stdout (scripting)',
  '  --fail-on-open           Exit non-zero when open findings remain',
  '  --open                   Open the browser after the scan',
  '  --port <n>               Local server port (default 4173, 0 = pick a free port)',
  '  --no-open                Do not open the browser after serving',
  '  --target <dir>           Demo repository target directory',
  '  --seed <seed>            Demo generator seed (default: placard-demo)',
  '  --serve                  Run the demo then start the local server',
  '  --finding <id>           Target finding (ritual rotate/purge/verify/certificate)',
  '  --reason <text>          Reason for a dismissal or a not-applicable rotation',
  '  --help, -h               Show this help',
].join('\n');

/** Commandes reconnues, dans l'ordre du contrat. */
const COMMANDS: readonly CliCommandName[] = ['scan', 'serve', 'ritual', 'demo', 'selftest'];

/** Options à valeur : la valeur suit immédiatement le drapeau. */
const VALUE_FLAGS = new Set([
  '--out',
  '--report',
  '--port',
  '--target',
  '--seed',
  '--finding',
  '--reason',
]);

/** Drapeaux booléens reconnus. */
const BOOL_FLAGS = new Set([
  '--staged',
  '--json',
  '--fail-on-open',
  '--open',
  '--no-open',
  '--serve',
  '--help',
  '-h',
]);

/** Résultat du découpage, avant exécution. */
export interface ParsedArgs {
  command?: CliCommandName;
  /** Arguments positionnels restants (chemin du dépôt, rapport, sous-commande). */
  positional: string[];
  /** Valeurs des drapeaux à valeur, sans le préfixe `--`. */
  values: Record<string, string>;
  /** Drapeaux booléens vus (sans le préfixe `--`). */
  flags: Record<string, boolean>;
  /** Vrai si `--help` a été demandé : l'appelant affiche l'usage et sort 0. */
  help: boolean;
  /** Erreur d'usage, en anglais, jamais de valeur détectée. */
  error?: string;
}

function blank(): ParsedArgs {
  return { positional: [], values: {}, flags: {}, help: false };
}

/** Un drapeau est-il connu ? La lettre courte `-h` est la seule acceptée. */
function isKnownFlag(token: string): boolean {
  return token === '-h' || token.startsWith('--');
}

/** Parse la liste d'arguments ; ne lève jamais. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed = blank();
  let expectingValue: string | undefined;
  for (const token of argv) {
    if (expectingValue !== undefined) {
      parsed.values[expectingValue] = token;
      expectingValue = undefined;
      continue;
    }
    if (token === '--help' || token === '-h') {
      parsed.help = true;
      continue;
    }
    if (isKnownFlag(token)) {
      const name = token.slice(2);
      if (VALUE_FLAGS.has(token)) {
        expectingValue = name;
        continue;
      }
      if (!BOOL_FLAGS.has(token)) {
        parsed.error = `unknown option: ${token}`;
        return parsed;
      }
      parsed.flags[name] = true;
      continue;
    }
    if (parsed.command === undefined) {
      const command = token as CliCommandName;
      if (!COMMANDS.includes(command)) {
        parsed.error = `unknown command: ${token}`;
        return parsed;
      }
      parsed.command = command;
      continue;
    }
    parsed.positional.push(token);
  }
  if (expectingValue !== undefined) {
    parsed.error = `missing value for --${expectingValue}`;
  }
  return parsed;
}
