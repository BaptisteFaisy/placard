import { describe, expect, it } from 'vitest';

import type { HistoryEvent } from '@placard/core';

import { readHistory } from './index.js';
import { createFixture, needle, type Fixture } from './testing/fixture.js';
import { useGitFixtures } from './testing/harness.js';

/** Dépôt de N commits, chacun ajoutant une ligne à un fichier suivi. */
function linearRepo(commits: number): Fixture {
  const fixture = createFixture();
  const rows: string[] = [];
  for (let index = 0; index < commits; index += 1) {
    rows.push(`${needle(index)}`);
    fixture.write('history.log', `${rows.join('\n')}\n`);
    fixture.commit(`commit ${index}`);
  }
  return fixture;
}

describe('annulation (AbortSignal)', () => {
  const track = useGitFixtures();


  it('s’arrête proprement quand le signal est déjà levé', async () => {
    const fixture = linearRepo(3);
    track(fixture);
    const controller = new AbortController();
    controller.abort();
    const events: HistoryEvent[] = [];
    const result = await readHistory({
      repoDir: fixture.dir,
      signal: controller.signal,
      onEvent: (event) => events.push(event),
    });
    expect(result.aborted).toBe(true);
    expect(events.some((event) => event.kind === 'repo')).toBe(true);
    expect(events.some((event) => event.kind === 'end')).toBe(true);
  });

  it('s’arrête au milieu du parcours et ne lit pas tout', async () => {
    const fixture = linearRepo(40);
    track(fixture);
    const controller = new AbortController();
    let seen = 0;
    const result = await readHistory({
      repoDir: fixture.dir,
      signal: controller.signal,
      onEvent: (event) => {
        if (event.kind === 'commit') {
          seen += 1;
          if (seen === 3) controller.abort();
        }
      },
    });
    expect(result.aborted).toBe(true);
    expect(result.commits).toBeLessThan(40);
    expect(result.commits).toBeGreaterThanOrEqual(3);
  });

  it('ne laisse aucun processus Git derrière elle', async () => {
    const fixture = linearRepo(20);
    track(fixture);
    const controller = new AbortController();
    const before = process.getActiveResourcesInfo().filter((name) => name === 'ProcessWrap').length;
    let seen = 0;
    await readHistory({
      repoDir: fixture.dir,
      signal: controller.signal,
      onEvent: (event) => {
        if (event.kind === 'commit') {
          seen += 1;
          if (seen === 2) controller.abort();
        }
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const after = process.getActiveResourcesInfo().filter((name) => name === 'ProcessWrap').length;
    expect(after).toBeLessThanOrEqual(before);
  });
});
