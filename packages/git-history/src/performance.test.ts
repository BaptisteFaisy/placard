import { describe, expect, it } from 'vitest';

import type { HistoryEvent } from '@placard/core';

import { readHistory } from './index';
import { createFixture, needle } from './testing/fixture';
import { useGitFixtures } from './testing/harness';

/**
 * Performance : le cahier des charges vise 5 000 commits, mais la CI tourne sur
 * un runner partagé et doit rendre son verdict en moins de 5 minutes. Le test
 * se borne donc à ~300 commits ; la cible 5 000 est documentée, pas testée.
 */
const PERF_COMMITS = 300;
const PERF_BUDGET_MS = 30_000;

describe('performance', () => {
  const track = useGitFixtures();


  it(`parcourt ${PERF_COMMITS} commits en moins de ${PERF_BUDGET_MS / 1000} s`, async () => {
    const fixture = createFixture();
    track(fixture);
    const rows: string[] = [];
    for (let index = 0; index < PERF_COMMITS; index += 1) {
      rows.push(`${needle(index)}`);
      fixture.write('journal.log', `${rows.join('\n')}\n`);
      fixture.commit(`commit ${index}`);
    }
    let commits = 0;
    let lines = 0;
    const started = Date.now();
    const result = await readHistory({
      repoDir: fixture.dir,
      onEvent: (event: HistoryEvent) => {
        if (event.kind === 'commit') commits += 1;
        if (event.kind === 'line') lines += 1;
      },
    });
    const elapsed = Date.now() - started;
    expect(result.commits).toBe(PERF_COMMITS);
    expect(commits).toBe(PERF_COMMITS);
    // Chaque commit n'ajoute qu'une ligne : les autres sont déjà présentes.
    expect(lines).toBe(PERF_COMMITS);
    expect(elapsed).toBeLessThan(PERF_BUDGET_MS);
  }, 180_000);

  it('garde une empreinte mémoire bornée sur un gros fichier', async () => {
    const fixture = createFixture();
    track(fixture);
    const lines: string[] = [];
    for (let index = 0; index < 20_000; index += 1) lines.push(`line ${index} ${needle(index)}`);
    fixture.write('huge.log', `${lines.join('\n')}\n`);
    fixture.commit('big file');
    let emitted = 0;
    const before = process.memoryUsage().heapUsed;
    const result = await readHistory({
      repoDir: fixture.dir,
      onEvent: (event) => {
        if (event.kind === 'line') emitted += 1;
      },
    });
    const growth = process.memoryUsage().heapUsed - before;
    expect(result.lines).toBe(20_000);
    expect(emitted).toBe(20_000);
    // Le contenu d'un fichier de ~600 Ko ne doit pas être retenu en mémoire.
    expect(growth).toBeLessThan(64 * 1024 * 1024);
  }, 180_000);
});
