import { describe, expect, it } from 'vitest';

import type {
  CommitEvent,
  DiffLineEvent,
  HistoryEvent,
  ReadHistoryOptions,
  ReadHistoryResult,
  RepoSnapshot,
} from '@placard/core';

import { createHistoryReader, readHistory } from './index.js';
import { createFixture, needle, type Fixture } from './testing/fixture.js';
import { useGitFixtures } from './testing/harness.js';

interface Collected {
  events: HistoryEvent[];
  result: ReadHistoryResult;
}

async function collect(dir: string, extra: Partial<ReadHistoryOptions> = {}): Promise<Collected> {
  const events: HistoryEvent[] = [];
  const result = await readHistory({
    repoDir: dir,
    onEvent: (event) => events.push(event),
    ...extra,
  });
  return { events, result };
}

function repoEvent(events: HistoryEvent[]): RepoSnapshot {
  const first = events.find((event) => event.kind === 'repo');
  if (first === undefined || first.kind !== 'repo') throw new Error('missing repo event');
  return first.repo;
}

function commitEvents(events: HistoryEvent[]): CommitEvent[] {
  return events.flatMap((event) => (event.kind === 'commit' ? [event.commit] : []));
}

function lineEvents(events: HistoryEvent[]): DiffLineEvent[] {
  return events.flatMap((event) => (event.kind === 'line' ? [event.line] : []));
}

function linesOf(events: HistoryEvent[], sha: string): DiffLineEvent[] {
  return lineEvents(events).filter((line) => line.commit === sha);
}

/**
 * Données émises pour un commit, `index` exclu : ajouter un commit plus récent
 * décale la position de parcours sans changer la moindre donnée du commit
 * (PLA-P-12).
 */
function eventsOfCommit(events: HistoryEvent[], sha: string): unknown[] {
  const kept: unknown[] = [];
  for (const event of events) {
    if (event.kind === 'commit' && event.commit.commit === sha) {
      const { index: _index, ...rest } = event.commit;
      kept.push({ kind: 'commit', commit: rest });
    } else if (event.kind === 'line' && event.line.commit === sha) {
      kept.push(event);
    } else if (event.kind === 'skipped' && event.skipped.commit === sha) {
      kept.push(event);
    }
  }
  return kept;
}

/** Dépôt à deux branches : une ligne ajoutée puis retirée sur `main`. */
function buildScenario(): Fixture {
  const fixture = createFixture();
  fixture.write('app.ts', 'one\ntwo\nthree\n');
  fixture.commit('initial');
  fixture.git(['checkout', '-q', '-b', 'feature']);
  fixture.write('feature.ts', `${needle(1)}\n`);
  fixture.commit('feature adds a needle');
  fixture.git(['checkout', '-q', 'main']);
  fixture.write('app.ts', `one\ntwo\n${needle(2)}\nthree\n`);
  fixture.commit('main adds a needle');
  fixture.write('app.ts', 'one\ntwo\nthree\n');
  fixture.commit('main removes the needle');
  return fixture;
}

describe('readHistory', () => {
  const track = useGitFixtures();


  function scenario(): Fixture {
    const fixture = buildScenario();
    track(fixture);
    return fixture;
  }

  it('parcourt toutes les branches et émet un événement repo puis end', async () => {
    const fixture = scenario();
    const { events, result } = await collect(fixture.dir);
    const repo = repoEvent(events);
    expect(repo.name).toBe(fixture.dir.split('/').pop());
    expect(repo.head).toBe(fixture.head());
    expect(repo.shortHead).toBe(fixture.head().slice(0, 7));
    expect(repo.totalCommits).toBe(4);
    expect(repo.branches).toEqual(['feature', 'main']);
    expect(repo.tags).toEqual([]);
    expect(repo.publicRemote).toBe(false);
    expect(repo.remotes).toEqual([]);
    expect(repo.firstCommitDate).toBeDefined();
    expect(repo.lastCommitDate).toBeDefined();
    expect(result.commits).toBe(4);
    expect(result.aborted).toBe(false);
    const last = events[events.length - 1];
    expect(last).toEqual({ kind: 'end', commits: 4, lines: result.lines });
  });

  it('lit les lignes ajoutées ET retirées avec leur numéro de ligne', async () => {
    const fixture = scenario();
    const { events } = await collect(fixture.dir);
    const commits = commitEvents(events);
    const added = commits.find((commit) => commit.subject === 'main adds a needle');
    const removed = commits.find((commit) => commit.subject === 'main removes the needle');
    expect(added).toBeDefined();
    expect(removed).toBeDefined();
    const addedLines = linesOf(events, added?.commit ?? '');
    expect(addedLines).toEqual([
      { commit: added?.commit, path: 'app.ts', line: 3, text: needle(2), side: 'added' },
    ]);
    const removedLines = linesOf(events, removed?.commit ?? '');
    expect(removedLines).toEqual([
      { commit: removed?.commit, path: 'app.ts', line: 3, text: needle(2), side: 'removed' },
    ]);
  });

  it('numérote les commits dans l’ordre du parcours', async () => {
    const fixture = scenario();
    const { events } = await collect(fixture.dir);
    expect(commitEvents(events).map((commit) => commit.index)).toEqual([0, 1, 2, 3]);
    expect(commitEvents(events)[0]?.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(commitEvents(events)[0]?.year).toBe(2021);
  });

  it('émet une progression croissante jusqu’au total', async () => {
    const fixture = scenario();
    const { events } = await collect(fixture.dir);
    const progress = events.flatMap((event) =>
      event.kind === 'progress' ? [{ scanned: event.scanned, total: event.total }] : [],
    );
    expect(progress.length).toBeGreaterThanOrEqual(2);
    expect(progress[0]).toEqual({ scanned: 0, total: 4 });
    expect(progress[progress.length - 1]).toEqual({ scanned: 4, total: 4 });
    const scanned = progress.map((entry) => entry.scanned);
    expect([...scanned].sort((a, b) => a - b)).toEqual(scanned);
  });

  it('respecte refs et maxCommits', async () => {
    const fixture = scenario();
    const onlyMain = await collect(fixture.dir, { refs: ['main'] });
    expect(onlyMain.result.commits).toBe(3);
    const limited = await collect(fixture.dir, { maxCommits: 2 });
    expect(limited.result.commits).toBe(2);
    expect(commitEvents(limited.events).map((commit) => commit.index)).toEqual([0, 1]);
  });

  it('annonce un total cohérent avec les références demandées', async () => {
    const fixture = scenario();
    const { events } = await collect(fixture.dir, { refs: ['feature'] });
    const progress = events.flatMap((event) =>
      event.kind === 'progress' ? [{ scanned: event.scanned, total: event.total }] : [],
    );
    // La branche `feature` porte le commit initial plus le sien.
    expect(progress[progress.length - 1]).toEqual({ scanned: 2, total: 2 });
  });

  it('produit deux parcours identiques (déterminisme)', async () => {
    const fixture = scenario();
    const first = await collect(fixture.dir);
    const second = await collect(fixture.dir);
    expect(second.events).toEqual(first.events);
    expect(second.result).toEqual(first.result);
  });

  it('n’altère aucune donnée déjà émise quand un commit neutre est ajouté', async () => {
    const fixture = scenario();
    const before = await collect(fixture.dir);
    const previousShas = commitEvents(before.events).map((commit) => commit.commit);
    fixture.write('notes.txt', 'nothing to see here\n');
    fixture.commit('unrelated file');
    const after = await collect(fixture.dir);
    expect(after.result.commits).toBe(before.result.commits + 1);
    for (const sha of previousShas) {
      expect(eventsOfCommit(after.events, sha)).toEqual(eventsOfCommit(before.events, sha));
    }
  });
});

describe('readHistory — vie d’une donnée dans l’historique', () => {
  const track = useGitFixtures();

  /** Dépôt du scénario partagé (deux branches, ajout puis retrait). */
  function scenario(): Fixture {
    return track(buildScenario());
  }

  it('lit les lignes d’un fichier supprimé, avec le bon chemin', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('kept.ts', 'kept\n');
    fixture.write('doomed.ts', `first\n${needle(9)}\n`);
    fixture.commit('add both files');
    fixture.remove('doomed.ts');
    const sha = fixture.commit('delete one file');
    const { events } = await collect(fixture.dir);
    const removed = linesOf(events, sha);
    expect(removed.map((line) => line.path)).toEqual(['doomed.ts', 'doomed.ts']);
    expect(removed.every((line) => line.side === 'removed')).toBe(true);
    expect(removed.map((line) => line.text)).toEqual(['first', needle(9)]);
  });

  it('suit un renommage comme une suppression puis une création', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('before.ts', `${needle(4)}\n`);
    fixture.commit('initial file');
    fixture.git(['mv', 'before.ts', 'after.ts']);
    const sha = fixture.commit('rename file');
    const { events } = await collect(fixture.dir);
    const moved = linesOf(events, sha);
    const removedSide = moved.filter((line) => line.side === 'removed');
    const addedSide = moved.filter((line) => line.side === 'added');
    expect(removedSide.map((line) => line.path)).toEqual(['before.ts']);
    expect(addedSide.map((line) => line.path)).toEqual(['after.ts']);
    expect(addedSide[0]?.text).toBe(needle(4));
  });

  it('expose un lecteur réutilisable via createHistoryReader', async () => {
    const fixture = scenario();
    const reader = createHistoryReader();
    const events: HistoryEvent[] = [];
    const result = await reader.read({ repoDir: fixture.dir, onEvent: (event) => events.push(event) });
    expect(result.commits).toBe(4);
    expect(events.some((event) => event.kind === 'end')).toBe(true);
  });

  it('refuse un dossier qui n’est pas un dépôt Git', async () => {
    await expect(
      readHistory({ repoDir: '/tmp/definitely-not-a-repository', onEvent: () => undefined }),
    ).rejects.toThrow(/not a git repository/);
  });

  it('gère un dépôt sans aucun commit', async () => {
    const fixture = createFixture();
    track(fixture);
    const { events, result } = await collect(fixture.dir);
    expect(result.commits).toBe(0);
    expect(result.lines).toBe(0);
    expect(repoEvent(events).totalCommits).toBe(0);
    expect(events[events.length - 1]).toEqual({ kind: 'end', commits: 0, lines: 0 });
  });
});
