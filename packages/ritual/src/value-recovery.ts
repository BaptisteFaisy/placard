import type { Finding } from '@placard/core';

import { git } from './git-exec';

/**
 * Récupération de la valeur d'une trouvaille (PLA-F-24).
 *
 * Le rapport Placard ne contient jamais la valeur (PLA-N-02) : il ne porte que
 * l'empreinte HMAC et un aperçu masqué. Pour écrire le fichier de
 * remplacements, le rituel relit donc la ligne d'origine dans le dépôt analysé,
 * puis isole la valeur à partir de l'indice contenu dans l'aperçu
 * (`AKIA…(20)`, `1234…5678`, `[REDACTED:family](len)`).
 *
 * Quand l'isolement échoue, la valeur de repli est la ligne entière : c'est
 * brutal mais jamais faux, et l'appelant en avertit l'utilisateur.
 */

const MAX_FALLBACK_LINE = 500;
const TOKEN_RE = /[A-Za-z0-9_\-+./:@]+/g;

/** Valeur retrouvée et degré de précision de l'extraction. */
export interface RecoveredValue {
  value: string;
  /** `false` : la ligne entière sera remplacée, faute d'avoir isolé la valeur. */
  precise: boolean;
}

type Hint =
  | { kind: 'prefix-length'; prefix: string; length: number }
  | { kind: 'anchored'; head: string; tail: string }
  | { kind: 'length'; length: number }
  | { kind: 'none' };

/** Décode l'aperçu masqué produit par `redactPreview`. */
export function parsePreview(preview: string): Hint {
  const withPrefix = /^(.*)…\((\d+)\)$/u.exec(preview);
  if (withPrefix !== null) {
    const prefix = withPrefix[1] ?? '';
    const length = Number(withPrefix[2]);
    if (prefix.length >= 4 && Number.isFinite(length)) return { kind: 'prefix-length', prefix, length };
    if (Number.isFinite(length)) return { kind: 'length', length };
  }
  const anchored = /^(.{4})…(.{4})$/u.exec(preview);
  if (anchored !== null) {
    return { kind: 'anchored', head: anchored[1] ?? '', tail: anchored[2] ?? '' };
  }
  const redacted = /^\[REDACTED:[a-z-]+\]\((\d+)\)$/u.exec(preview);
  if (redacted !== null) {
    const length = Number(redacted[1]);
    if (Number.isFinite(length)) return { kind: 'length', length };
  }
  return { kind: 'none' };
}

function tokens(line: string): string[] {
  return line.match(TOKEN_RE) ?? [];
}

/** Cherche la valeur d'après l'aperçu, dans une seule ligne. */
export function extractFromLine(line: string, preview: string): string | undefined {
  const hint = parsePreview(preview);
  if (hint.kind === 'none') return undefined;
  const candidates = tokens(line);
  if (hint.kind === 'prefix-length') {
    const found = candidates.find(
      (token) => token.startsWith(hint.prefix) && token.length === hint.length,
    );
    return found;
  }
  if (hint.kind === 'anchored') {
    return candidates.find(
      (token) =>
        token.startsWith(hint.head) && token.endsWith(hint.tail) && token.length > hint.head.length + hint.tail.length,
    );
  }
  const sameLength = candidates.filter((token) => token.length === hint.length);
  return sameLength.length === 1 ? sameLength[0] : undefined;
}

/** Reconstitue un bloc de clé privée à partir de son indice de ligne. */
export function extractKeyBlock(lines: string[], index: number): string | undefined {
  let start = -1;
  for (let i = Math.min(index, lines.length - 1); i >= 0; i -= 1) {
    if ((lines[i] ?? '').includes('-----BEGIN')) {
      start = i;
      break;
    }
  }
  if (start < 0) return undefined;
  for (let i = start; i < lines.length; i += 1) {
    if ((lines[i] ?? '').includes('-----END')) return lines.slice(start, i + 1).join('\n');
  }
  return undefined;
}

async function readFileAtCommit(
  repoDir: string,
  commit: string,
  path: string,
): Promise<string | undefined> {
  const result = await git(['-C', repoDir, 'show', `${commit}:${path}`]);
  return result.ok ? result.stdout : undefined;
}

function recoverFromContent(finding: Finding, content: string, line: number): RecoveredValue | undefined {
  const lines = content.split('\n');
  const index = line - 1;
  if (finding.family === 'private-key') {
    const block = extractKeyBlock(lines, index);
    if (block !== undefined) return { value: block, precise: true };
  }
  const text = lines[index] ?? '';
  const precise = extractFromLine(text, finding.preview);
  if (precise !== undefined) return { value: precise, precise: true };
  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length <= MAX_FALLBACK_LINE) {
    return { value: trimmed, precise: false };
  }
  return undefined;
}

/** Relit la valeur d'une trouvaille dans le dépôt analysé (jamais dans le rapport). */
export async function recoverValue(
  repoDir: string,
  finding: Finding,
): Promise<RecoveredValue | undefined> {
  for (const location of finding.locations) {
    const content = await readFileAtCommit(repoDir, location.commit, location.path);
    if (content === undefined) continue;
    const recovered = recoverFromContent(finding, content, location.line);
    if (recovered !== undefined) return recovered;
  }
  return undefined;
}

