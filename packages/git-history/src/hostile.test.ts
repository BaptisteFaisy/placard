import { describe, expect, it } from 'vitest';

import type { DiffLineEvent, HistoryEvent } from '@placard/core';

import { MAX_LINE_CHARS, readHistory, sanitizePath, sanitizeText, stripEscapes } from './index';
import { createFixture, type Fixture } from './testing/fixture';
import { useGitFixtures } from './testing/harness';

const ESC = '\u001b';
const NUL = '\u0000';

async function collect(dir: string): Promise<{ events: HistoryEvent[]; lines: DiffLineEvent[] }> {
  const events: HistoryEvent[] = [];
  await readHistory({ repoDir: dir, onEvent: (event) => events.push(event) });
  const lines = events.flatMap((event) => (event.kind === 'line' ? [event.line] : []));
  return { events, lines };
}

/** Aucun caractère de contrôle ne doit subsister dans une chaîne émise. */
function hasControlChar(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x09) continue;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
}

describe('neutralisation du contenu hostile (PLA-N-03, PLA-P-10)', () => {
  const track = useGitFixtures();


  function repoWith(content: string | Uint8Array): Fixture {
    const fixture = createFixture();
    track(fixture);
    fixture.write('payload.txt', content);
    fixture.commit('hostile payload');
    return fixture;
  }

  it('retire les séquences ANSI d’une ligne émise', () => {
    expect(stripEscapes(`${ESC}[31mred${ESC}[0m`)).toBe('red');
    expect(stripEscapes(`${ESC}]0;title\u0007text`)).toBe('text');
    expect(stripEscapes(`${ESC}]8;;https://example.invalid${ESC}\\link${ESC}]8;;${ESC}\\`)).toBe('link');
  });

  it('remplace les caractères de contrôle et garde les tabulations', () => {
    const cleaned = sanitizeText(`a${NUL}b\tc${ESC}[2Jd`);
    expect(cleaned).toBe('a?b\tcd');
    expect(sanitizeText(`a${NUL}b\tc${ESC}D`)).toBe('a?b\tc');
    expect(sanitizeText(`a${NUL}b\tc\u0007d`)).toBe('a?b\tc?d');
    expect(hasControlChar(cleaned)).toBe(false);
  });

  it('tronque une ligne démesurée', () => {
    const huge = 'x'.repeat(MAX_LINE_CHARS * 3);
    const cleaned = sanitizeText(huge);
    expect(cleaned.length).toBeLessThanOrEqual(MAX_LINE_CHARS + 1);
    expect(cleaned.endsWith('\u2026')).toBe(true);
  });

  it('neutralise aussi les séquences présentes dans un chemin', () => {
    const cleaned = sanitizePath(`dir/${ESC}[31mname${NUL}.txt`);
    expect(hasControlChar(cleaned)).toBe(false);
    expect(cleaned).toBe('dir/name?.txt');
  });

  it('survit à une ligne d’un mégaoctet et la borne', async () => {
    const fixture = repoWith(`${'y'.repeat(1024 * 1024)}\n`);
    const events: HistoryEvent[] = [];
    await readHistory({
      repoDir: fixture.dir,
      maxFileBytes: 8 * 1024 * 1024,
      onEvent: (event) => events.push(event),
    });
    const lines = events.flatMap((event) => (event.kind === 'line' ? [event.line] : []));
    expect(lines).toHaveLength(1);
    expect(lines[0]?.text.length).toBeLessThanOrEqual(MAX_LINE_CHARS + 1);
    expect(hasControlChar(lines[0]?.text ?? '')).toBe(false);
  });

  it('survit à des octets nuls dans un fichier texte forcé', async () => {
    const fixture = repoWith(`before${NUL}after\n`);
    const { lines } = await collect(fixture.dir);
    for (const line of lines) expect(hasControlChar(line.text)).toBe(false);
  });

  it('survit à une séquence ANSI complète dans le contenu', async () => {
    const fixture = repoWith(`${ESC}[31msecret${ESC}[0m ${ESC}]0;evil\u0007\n`);
    const { lines } = await collect(fixture.dir);
    expect(lines.length).toBeGreaterThan(0);
    const text = lines.map((line) => line.text).join('\n');
    expect(text).not.toContain(ESC);
    expect(text).toContain('secret');
  });

  it('survit à une UTF-8 invalide', async () => {
    const fixture = repoWith(Buffer.from([0x66, 0x6f, 0x6f, 0xff, 0xfe, 0x0a]));
    const { events, lines } = await collect(fixture.dir);
    expect(events.some((event) => event.kind === 'end')).toBe(true);
    for (const line of lines) expect(hasControlChar(line.text)).toBe(false);
  });

  it('restitue un chemin non ASCII à l’identique', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('caf\u00e9/r\u00e9sum\u00e9.txt', 'content\n');
    fixture.commit('unicode path');
    const { lines } = await collect(fixture.dir);
    expect(lines[0]?.path).toBe('caf\u00e9/r\u00e9sum\u00e9.txt');
  });

  it('survit à un nom de fichier hostile', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('weird name with spaces.txt', 'content\n');
    fixture.commit('odd name');
    const { lines } = await collect(fixture.dir);
    expect(lines[0]?.path).toBe('weird name with spaces.txt');
  });

  it('n’émet jamais de caractère de contrôle, quel que soit le contenu', async () => {
    const fixture = createFixture();
    track(fixture);
    fixture.write('a.txt', `ok\n${ESC}[1;31m${NUL}bad${ESC}[0m\n`);
    fixture.write('b.txt', `${'z'.repeat(200_000)}\n`);
    fixture.commit('hostile batch');
    const { events } = await collect(fixture.dir);
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('\\u001b');
    expect(serialized).not.toContain('\\u0000');
  });
});
