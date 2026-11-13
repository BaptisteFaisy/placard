import { describe, expect, it } from 'vitest';

import {
  DiffParser,
  parseDiffPath,
  parseHeaderPath,
  unquoteGitPath,
  type DiffParserSink,
} from './diff-parser';
import { globToRegExp, compileIgnorePatterns } from './ignore-paths';
import { parseBatchCheckLine } from './blob-sizes';
import { isPublicRemote, repoName } from './repo-info';
import { normalizeRefs, parseRecord, RECORD_MARKER } from './log-stream';
import { isoDate } from './scan';

/** Récepteur de test : enregistre les événements du parseur sous forme lisible. */
function recorder(): { sink: DiffParserSink; log: string[] } {
  const log: string[] = [];
  const sink: DiffParserSink = {
    file: (path?: string) => {
      log.push(`file:${path ?? '-'}`);
    },
    path: (path: string) => {
      log.push(`path:${path}`);
    },
    binary: (path: string, sha?: string) => {
      log.push(`binary:${path}:${sha ?? '-'}`);
    },
    hunk: () => {
      log.push('hunk');
    },
    line: (side: string, lineNumber: number, text: string) => {
      log.push(`${side}:${lineNumber}:${text}`);
    },
  };
  return { sink, log };
}

describe('parseur de diff', () => {
  it('décode un chemin guillemeté', () => {
    expect(unquoteGitPath('"caf\\303\\251.txt"')).toBe('café.txt');
    expect(unquoteGitPath('plain.txt')).toBe('plain.txt');
    expect(unquoteGitPath('"a\\tb"')).toBe('a\tb');
  });

  it('lit un chemin de diff et retire le préfixe', () => {
    expect(parseDiffPath('b/src/app.ts', 'b')).toBe('src/app.ts');
    expect(parseDiffPath('a/src/app.ts\t', 'a')).toBe('src/app.ts');
    expect(parseDiffPath('/dev/null', 'b')).toBeUndefined();
    expect(parseDiffPath('', 'b')).toBeUndefined();
  });

  it('déduit un chemin d’en-tête seulement quand les deux côtés concordent', () => {
    expect(parseHeaderPath('a/x.txt b/x.txt')).toBe('x.txt');
    expect(parseHeaderPath('a/old.txt b/new.txt')).toBeUndefined();
    expect(parseHeaderPath('x.txt b/x.txt')).toBeUndefined();
  });

  it('suit un fichier ajouté, hunk et lignes', () => {
    const { sink, log } = recorder();
    const parser = new DiffParser(sink);
    parser.push('diff --git a/app.ts b/app.ts');
    parser.push('new file mode 100644');
    parser.push('index 0000000..1111111 100644');
    parser.push('--- /dev/null');
    parser.push('+++ b/app.ts');
    parser.push('@@ -0,0 +1,2 @@');
    parser.push('+one');
    parser.push('+two');
    expect(log).toEqual([
      'file:app.ts',
      'path:app.ts',
      'hunk',
      'added:1:one',
      'added:2:two',
    ]);
  });

  it('numérote les retraits comme la nouvelle version du fichier', () => {
    const { sink, log } = recorder();
    const parser = new DiffParser(sink);
    parser.push('diff --git a/app.ts b/app.ts');
    parser.push('index 111..222 100644');
    parser.push('--- a/app.ts');
    parser.push('+++ b/app.ts');
    parser.push('@@ -2 +1,0 @@ context');
    parser.push('-gone');
    expect(log).toContain('removed:2:gone');
  });

  it('signale un fichier binaire avec le SHA du blob', () => {
    const { sink, log } = recorder();
    const parser = new DiffParser(sink);
    parser.push('diff --git a/logo.bin b/logo.bin');
    parser.push('new file mode 100644');
    parser.push('index 0000000000000000000000000000000000000000..abcdef1234567890abcdef1234567890abcdef12');
    parser.push('Binary files /dev/null and b/logo.bin differ');
    expect(log).toContain('binary:logo.bin:abcdef1234567890abcdef1234567890abcdef12');
  });

  it('ignore un contenu qui imite une en-tête', () => {
    const { sink, log } = recorder();
    const parser = new DiffParser(sink);
    parser.push('diff --git a/f.txt b/f.txt');
    parser.push('--- a/f.txt');
    parser.push('+++ b/f.txt');
    parser.push('@@ -0,0 +1 @@');
    parser.push('+diff --git a/evil b/evil');
    parser.push('+@@ -1 +1 @@');
    expect(log.filter((entry) => entry.startsWith('file:'))).toHaveLength(1);
    expect(log).toContain('added:1:diff --git a/evil b/evil');
    expect(log).toContain('added:2:@@ -1 +1 @@');
  });

  it('ne lève pas d’exception sur une entrée tronquée', () => {
    const { sink } = recorder();
    const parser = new DiffParser(sink);
    expect(() => {
      parser.push('@@ malformed @@');
      parser.push('+++');
      parser.push('---');
      parser.push('Binary files');
      parser.push('');
    }).not.toThrow();
  });
});

describe('motifs de chemins ignorés', () => {
  it('convertit un glob en expression ancrée', () => {
    expect(globToRegExp('*.log').test('a.log')).toBe(true);
    expect(globToRegExp('*.log').test('dir/a.log')).toBe(false);
    expect(globToRegExp('src/**').test('src/a/b.ts')).toBe(true);
    expect(globToRegExp('a?c').test('abc')).toBe(true);
    expect(globToRegExp('a.b').test('axb')).toBe(false);
  });

  it('applique un motif sans barre à chaque segment', () => {
    const filter = compileIgnorePatterns(['node_modules', '*.lock']);
    expect(filter('node_modules/pkg/index.js')).toBe(true);
    expect(filter('deep/node_modules/x.js')).toBe(true);
    expect(filter('pnpm-lock.lock')).toBe(true);
    expect(filter('src/index.ts')).toBe(false);
  });

  it('applique un motif avec barre au chemin complet', () => {
    const filter = compileIgnorePatterns(['vendor/**', 'docs/*.md']);
    expect(filter('vendor/lib/a.js')).toBe(true);
    expect(filter('docs/readme.md')).toBe(true);
    expect(filter('docs/sub/deep.md')).toBe(false);
    expect(filter('src/vendor.ts')).toBe(false);
  });

  it('n’ignore rien sans motif', () => {
    expect(compileIgnorePatterns(undefined)('anything')).toBe(false);
    expect(compileIgnorePatterns([])('anything')).toBe(false);
    expect(compileIgnorePatterns(['  ', './'])('anything')).toBe(false);
  });
});

describe('oracle de taille', () => {
  it('lit une réponse de cat-file', () => {
    expect(parseBatchCheckLine('abc123 blob 1024')).toBe(1024);
    expect(parseBatchCheckLine('abc123 tree 12')).toBeUndefined();
    expect(parseBatchCheckLine('abc123 missing')).toBeUndefined();
    expect(parseBatchCheckLine(undefined)).toBeUndefined();
    expect(parseBatchCheckLine('abc123 blob notanumber')).toBeUndefined();
  });
});

describe('distants publics', () => {
  it('reconnaît un distant http(s) public', () => {
    expect(isPublicRemote('https://github.com/acme/repo.git')).toBe(true);
    expect(isPublicRemote('http://git.example.org/acme/repo')).toBe(true);
  });

  it('refuse les hôtes privés, locaux et les schémas non http', () => {
    expect(isPublicRemote('https://localhost/repo')).toBe(false);
    expect(isPublicRemote('http://127.0.0.1/repo')).toBe(false);
    expect(isPublicRemote('http://192.168.1.10/repo')).toBe(false);
    expect(isPublicRemote('http://10.0.0.5/repo')).toBe(false);
    expect(isPublicRemote('http://box.local/repo')).toBe(false);
    expect(isPublicRemote('git@github.com:acme/repo.git')).toBe(false);
    expect(isPublicRemote('file:///srv/repo.git')).toBe(false);
    expect(isPublicRemote('not a url')).toBe(false);
  });
});

describe('nom du dépôt', () => {
  it('retire le suffixe .git', () => {
    expect(repoName('/srv/code/placard')).toBe('placard');
    expect(repoName('/srv/code/placard.git')).toBe('placard');
    expect(repoName('/srv/code/.git')).toBe('.git');
  });
});

describe('enregistrements de commit', () => {
  it('lit un enregistrement complet', () => {
    const line = `${RECORD_MARKER}abcdef1234567890abcdef1234567890abcdef12\u001fabcdef1\u001f1614751207\u001fAda\u001fa subject`;
    expect(parseRecord(line)).toEqual({
      commit: 'abcdef1234567890abcdef1234567890abcdef12',
      shortCommit: 'abcdef1',
      timestamp: 1614751207,
      author: 'Ada',
      subject: 'a subject',
    });
  });

  it('refuse une ligne ordinaire ou un SHA invalide', () => {
    expect(parseRecord('+a normal diff line')).toBeUndefined();
    expect(parseRecord(`${RECORD_MARKER}nothex\u001fx\u001f0\u001fy\u001fz`)).toBeUndefined();
  });

  it('refuse une référence qui ressemble à une option', () => {
    expect(normalizeRefs(['main', ' v1.0 '])).toEqual(['main', 'v1.0']);
    expect(() => normalizeRefs(['--exec=rm -rf /'])).toThrow(/invalid git ref/);
  });

  it('formate une date ISO et retombe sur l’époque pour une valeur absurde', () => {
    expect(isoDate(1614751207)).toBe('2021-03-03T06:00:07.000Z');
    expect(isoDate(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(isoDate(Number.NaN)).toBe('1970-01-01T00:00:00.000Z');
  });
});
