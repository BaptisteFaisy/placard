import { describe, expect, it } from 'vitest';

import type { HistoryEvent, ReadHistoryOptions, ReadHistoryResult, SkippedFileEvent } from '@placard/core';

import { readHistory } from './index.js';
import { createFixture, type Fixture } from './testing/fixture.js';
import { useGitFixtures } from './testing/harness.js';

const KB = 1024;

async function collect(dir: string, extra: Partial<ReadHistoryOptions> = {}): Promise<{
  events: HistoryEvent[];
  result: ReadHistoryResult;
}> {
  const events: HistoryEvent[] = [];
  const result = await readHistory({ repoDir: dir, onEvent: (event) => events.push(event), ...extra });
  return { events, result };
}

function skipped(events: HistoryEvent[]): SkippedFileEvent[] {
  return events.flatMap((event) => (event.kind === 'skipped' ? [event.skipped] : []));
}

function lines(events: HistoryEvent[]): number {
  return events.filter((event) => event.kind === 'line').length;
}

describe('fichiers ignorés et comptés (PLA-F-01)', () => {
  const track = useGitFixtures();


  /** Un dépôt mêlant texte, binaire et fichier volumineux. */
  function mixedRepo(): Fixture {
    const fixture = createFixture();
    track(fixture);
    fixture.write('readme.txt', 'hello\nworld\n');
    const binary = Buffer.from([0x00, 0x01, 0x02, 0x00, 0xff, 0xfe, 0x00, 0x00]);
    fixture.write('logo.bin', binary);
    const big = Buffer.alloc(40 * KB, 'a');
    fixture.write('data/big.log', big);
    fixture.commit('initial import');
    return fixture;
  }

  it('compte un fichier binaire comme ignoré, sans lire son contenu', async () => {
    const fixture = mixedRepo();
    const { events, result } = await collect(fixture.dir);
    const binary = skipped(events).filter((entry) => entry.reason === 'binary');
    expect(binary).toHaveLength(1);
    expect(binary[0]?.path).toBe('logo.bin');
    expect(binary[0]?.bytes).toBe(8);
    expect(result.skipped.binary).toBe(1);
    expect(result.skipped.tooLarge).toBe(0);
  });

  it('compte un fichier au-delà de maxFileBytes comme trop volumineux', async () => {
    const fixture = mixedRepo();
    const { events, result } = await collect(fixture.dir, { maxFileBytes: 4 * KB });
    const tooLarge = skipped(events).filter((entry) => entry.reason === 'too_large');
    expect(tooLarge).toHaveLength(1);
    expect(tooLarge[0]?.path).toBe('data/big.log');
    expect(tooLarge[0]?.bytes).toBe(40 * KB);
    expect(result.skipped.tooLarge).toBe(1);
    expect(result.skipped.binary).toBe(1);
  });

  it('lit les petits fichiers texte même quand d’autres sont ignorés', async () => {
    const fixture = mixedRepo();
    const { events } = await collect(fixture.dir, { maxFileBytes: 4 * KB });
    expect(lines(events)).toBe(2);
  });

  it('un fichier exactement à la borne reste analysé', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('edge.txt', Buffer.alloc(1000, 'b'));
    fixture.commit('edge');
    const { events, result } = await collect(fixture.dir, { maxFileBytes: 1000 });
    expect(result.skipped.tooLarge).toBe(0);
    expect(lines(events)).toBe(1);
  });

  it('un fichier juste au-dessus de la borne est compté', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('edge.txt', Buffer.alloc(1001, 'b'));
    fixture.commit('edge');
    const { events, result } = await collect(fixture.dir, { maxFileBytes: 1000 });
    expect(result.skipped.tooLarge).toBe(1);
    expect(skipped(events)[0]?.bytes).toBe(1001);
  });

  it('ignore les chemins demandés, sans les compter comme binaires', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('src/app.ts', 'alpha\n');
    fixture.write('vendor/lib.js', 'beta\n');
    fixture.write('logs/deep/trace.log', 'gamma\n');
    fixture.commit('mixed tree');
    const { events, result } = await collect(fixture.dir, {
      ignorePaths: ['vendor/**', '*.log'],
    });
    const paths = events.flatMap((event) => (event.kind === 'line' ? [event.line.path] : []));
    expect(paths).toEqual(['src/app.ts']);
    expect(result.skipped).toEqual({ binary: 0, tooLarge: 0 });
  });

  it('compte chaque version ignorée, pas chaque fichier', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('img.bin', Buffer.from([0, 1, 2]));
    fixture.commit('add image');
    fixture.write('img.bin', Buffer.from([0, 1, 2, 3]));
    fixture.commit('update image');
    const { events, result } = await collect(fixture.dir);
    expect(result.skipped.binary).toBe(2);
    expect(skipped(events).map((entry) => entry.commit)).toEqual(
      skipped(events).map((entry) => entry.commit),
    );
    const commits = events.flatMap((event) => (event.kind === 'commit' ? [event.commit.commit] : []));
    for (const entry of skipped(events)) expect(commits).toContain(entry.commit);
  });
});
