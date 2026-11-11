import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Outillage de test : de vrais dépôts Git temporaires.
 *
 * Aucune configuration Git globale n'est utilisée : identité, dates et fichiers
 * de configuration sont fournis par l'environnement de chaque commande. Les
 * dates sont fixées et croissantes, ce qui rend l'ordre de `git log` stable.
 */

const AUTHOR_NAME = 'Placard Fixture';
const AUTHOR_EMAIL = 'fixture@example.invalid';
const START_CLOCK = Date.parse('2021-03-04T05:06:07Z');
const CLOCK_STEP_MS = 60_000;

export interface Fixture {
  /** Racine du dépôt temporaire. */
  readonly dir: string;
  /** Exécute Git dans le dépôt et renvoie la sortie standard. */
  git(args: readonly string[]): string;
  /** Écrit un fichier (texte ou octets bruts) dans le dépôt. */
  write(rel: string, content: string | Uint8Array): void;
  /** Supprime un fichier du répertoire de travail. */
  remove(rel: string): void;
  /** Indexe toutes les modifications du répertoire de travail. */
  stage(): void;
  /** Crée un commit (date croissante) et renvoie son SHA. */
  commit(message: string): string;
  /** SHA de HEAD. */
  head(): string;
}

/** Isole les commandes Git de toute configuration utilisateur ou système. */
export function isolateGitEnvironment(): void {
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';
}

function envFor(clock: number): NodeJS.ProcessEnv {
  const date = new Date(clock).toISOString();
  return {
    ...process.env,
    GIT_AUTHOR_NAME: AUTHOR_NAME,
    GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
    GIT_COMMITTER_NAME: AUTHOR_NAME,
    GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
  };
}

/** Crée un dépôt vide (`git init -b main`) dans un dossier temporaire. */
export function createFixture(): Fixture {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'placard-gh-'));
  let clock = START_CLOCK;
  const run = (args: readonly string[]): string =>
    execFileSync('git', ['-C', dir, ...args], { env: envFor(clock), encoding: 'utf8' });

  const fixture: Fixture = {
    dir,
    git: run,
    write(rel, content) {
      const target = path.join(dir, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    },
    remove(rel) {
      fs.rmSync(path.join(dir, rel), { force: true });
    },
    stage() {
      run(['add', '-A']);
    },
    commit(message) {
      clock += CLOCK_STEP_MS;
      run(['add', '-A']);
      run(['commit', '-q', '-m', message]);
      return fixture.head();
    },
    head() {
      return run(['rev-parse', 'HEAD']).trim();
    },
  };
  run(['init', '-q', '-b', 'main']);
  return fixture;
}

/** Supprime le dépôt temporaire. */
export function destroyFixture(fixture: Fixture): void {
  fs.rmSync(fixture.dir, { recursive: true, force: true });
}

/** Contenu déterministe sans format de secret : ces tests n'inspectent que le diff. */
export function needle(index: number): string {
  return `needle-${index}-marker`;
}
