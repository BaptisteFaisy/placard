import { describe, expect, it } from 'vitest';

import type { DiffLineEvent, HistoryEvent, ReadHistoryResult } from '@placard/core';

import { readHistory } from './index';
import { createFixture, needle, type Fixture } from './testing/fixture';
import { useGitFixtures } from './testing/harness';

async function collectStaged(dir: string): Promise<{
  events: HistoryEvent[];
  lines: DiffLineEvent[];
  result: ReadHistoryResult;
}> {
  const events: HistoryEvent[] = [];
  const result = await readHistory({
    repoDir: dir,
    stagedOnly: true,
    onEvent: (event) => events.push(event),
  });
  const lines = events.flatMap((event) => (event.kind === 'line' ? [event.line] : []));
  return { events, lines, result };
}

describe('mode indexé (PLA-F-10)', () => {
  const track = useGitFixtures();


  function repo(): Fixture {
    const fixture = createFixture();
    track(fixture);
    fixture.write('app.ts', 'one\ntwo\n');
    fixture.commit('initial');
    return fixture;
  }

  it('ne lit que les modifications indexées, dans un unique commit virtuel', async () => {
    const fixture = repo();
    fixture.write('app.ts', `one\ntwo\n${needle(1)}\n`);
    fixture.stage();
    const { events, lines, result } = await collectStaged(fixture.dir);
    const commits = events.flatMap((event) => (event.kind === 'commit' ? [event.commit] : []));
    expect(commits).toHaveLength(1);
    expect(commits[0]?.commit).toBe(fixture.head());
    expect(commits[0]?.shortCommit).toBe(fixture.head().slice(0, 7));
    expect(commits[0]?.subject).toBe('Staged changes');
    expect(result.commits).toBe(1);
    expect(lines).toEqual([
      { commit: fixture.head(), path: 'app.ts', line: 3, text: needle(1), side: 'added' },
    ]);
  });

  it('ignore les modifications non indexées', async () => {
    const fixture = repo();
    fixture.write('app.ts', `one\ntwo\n${needle(2)}\n`);
    const { lines } = await collectStaged(fixture.dir);
    expect(lines).toEqual([]);
  });

  it('lit aussi les lignes retirées de l’index', async () => {
    const fixture = repo();
    fixture.write('app.ts', 'one\n');
    fixture.stage();
    const { lines } = await collectStaged(fixture.dir);
    expect(lines).toEqual([{ commit: fixture.head(), path: 'app.ts', line: 2, text: 'two', side: 'removed' }]);
  });

  it('signale les fichiers indexés binaires', async () => {
    const fixture = repo();
    fixture.write('blob.bin', Buffer.from([0, 1, 2, 3]));
    fixture.stage();
    const { events, result } = await collectStaged(fixture.dir);
    expect(result.skipped.binary).toBe(1);
    const skipped = events.flatMap((event) => (event.kind === 'skipped' ? [event.skipped] : []));
    expect(skipped[0]?.path).toBe('blob.bin');
    expect(skipped[0]?.reason).toBe('binary');
  });

  it('fonctionne sur un dépôt sans aucun commit', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('first.ts', `${needle(3)}\n`);
    fixture.stage();
    const { events, lines, result } = await collectStaged(fixture.dir);
    const commits = events.flatMap((event) => (event.kind === 'commit' ? [event.commit] : []));
    expect(commits).toHaveLength(1);
    expect(commits[0]?.shortCommit).toBe('staged');
    expect(lines.map((line) => line.text)).toEqual([needle(3)]);
    expect(result.commits).toBe(1);
  });

  it('n’émet rien quand l’index est vide', async () => {
    const fixture = repo();
    const { lines, result } = await collectStaged(fixture.dir);
    expect(lines).toEqual([]);
    expect(result.commits).toBe(1);
    expect(result.lines).toBe(0);
  });
});
