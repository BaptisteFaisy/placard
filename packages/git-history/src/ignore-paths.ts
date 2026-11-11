/**
 * Filtrage des chemins à ignorer (`ignorePaths`).
 *
 * Globs simples, volontairement limités : `*` ne traverse pas un `/`, `**` le
 * traverse, `?` remplace un caractère. Un motif sans `/` s'applique à chaque
 * segment du chemin (nom de fichier ou de dossier), ce qui couvre le cas
 * courant `node_modules` ou `*.lock`.
 */

/** Prédicat : ce chemin doit-il être ignoré ? */
export type PathFilter = (path: string) => boolean;

interface CompiledPattern {
  regex: RegExp;
  anySegment: boolean;
}

const REGEX_SPECIALS = /[.+^${}()|[\]\\]/;

/** Convertit un glob en expression régulière ancrée. */
export function globToRegExp(glob: string): RegExp {
  let out = '';
  let index = 0;
  while (index < glob.length) {
    const char = glob.charAt(index);
    if (char === '*') {
      if (glob.charAt(index + 1) === '*') {
        const slash = glob.charAt(index + 2) === '/';
        out += slash ? '(?:[^/]+/)*' : '.*';
        index += slash ? 3 : 2;
        continue;
      }
      out += '[^/]*';
      index += 1;
      continue;
    }
    if (char === '?') {
      out += '[^/]';
      index += 1;
      continue;
    }
    out += REGEX_SPECIALS.test(char) ? `\\${char}` : char;
    index += 1;
  }
  return new RegExp(`^${out}$`);
}

function compile(pattern: string): CompiledPattern | undefined {
  let glob = pattern.trim();
  if (glob === '') return undefined;
  if (glob.startsWith('./')) glob = glob.slice(2);
  while (glob.startsWith('/')) glob = glob.slice(1);
  if (glob.endsWith('/')) glob = `${glob}**`;
  if (glob === '') return undefined;
  return { regex: globToRegExp(glob), anySegment: !glob.includes('/') };
}

/** Le motif s'applique-t-il au chemin complet, à son nom, ou à un dossier parent ? */
function matchesSegment(regex: RegExp, path: string): boolean {
  if (regex.test(path)) return true;
  const parts = path.split('/');
  const last = parts[parts.length - 1];
  if (last !== undefined && regex.test(last)) return true;
  return parts.slice(0, -1).some((part) => regex.test(part));
}

/** Compile la liste de motifs en un prédicat unique (aucun motif = rien à ignorer). */
export function compileIgnorePatterns(patterns: readonly string[] | undefined): PathFilter {
  const compiled = (patterns ?? [])
    .map(compile)
    .filter((pattern): pattern is CompiledPattern => pattern !== undefined);
  if (compiled.length === 0) return () => false;
  return (path: string): boolean =>
    compiled.some((pattern) =>
      pattern.anySegment ? matchesSegment(pattern.regex, path) : pattern.regex.test(path),
    );
}
