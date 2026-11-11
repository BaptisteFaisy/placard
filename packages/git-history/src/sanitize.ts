/**
 * Neutralisation du contenu d'un dépôt avant émission (PLA-N-03, PLA-P-10).
 *
 * Le contenu d'un dépôt est une donnée **non fiable** : il peut contenir des
 * séquences d'échappement ANSI (effacement d'écran, hyperliens), des octets de
 * contrôle, des lignes d'un mégaoctet. Rien de tout cela ne doit atteindre un
 * terminal, un journal ou un rapport sans avoir été neutralisé ici.
 *
 * Le contenu n'est jamais exécuté : on ne fait que le transformer en texte.
 */

/** Longueur maximale d'une ligne émise, en caractères (PLA-P-10). */
export const MAX_LINE_CHARS = 8192;

/** Longueur maximale d'un chemin émis, en caractères. */
export const MAX_PATH_CHARS = 4096;

/**
 * Les motifs sont écrits avec des échappements `\u` explicites plutôt qu'avec
 * des caractères de contrôle littéraux : le code reste lisible et la règle
 * ESLint `no-control-regex` ne se déclenche pas sur un littéral invisible.
 */
const ESC = '\u001b';
/** Séquences CSI : `ESC [ … final` (couleurs, effacement, déplacement). */
const ANSI_CSI = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, 'g');
/** Séquences OSC : `ESC ] … BEL` ou `ESC ] … ST` (titres, hyperliens, presse-papier). */
const ANSI_OSC = new RegExp(`${ESC}\\][\\s\\S]*?(?:\\u0007|${ESC}\\\\)`, 'g');
/** Autres échappements à deux caractères (`ESC (` , `ESC =`, …). */
const ANSI_OTHER = new RegExp(`${ESC}[@-Z\\\\-_]`, 'g');
/** Échappement orphelin, une fois les séquences complètes retirées. */
const ANSI_LONE = new RegExp(ESC, 'g');
/**
 * Plages de caractères de contrôle à neutraliser : C0 sauf tabulation, DEL et
 * C1. La classe est construite depuis ces bornes pour qu'aucun caractère
 * invisible n'apparaisse dans le source.
 */
const CONTROL_RANGES: readonly (readonly [number, number])[] = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
];

function controlClass(): string {
  const ranges = CONTROL_RANGES.map(
    ([from, to]) => `${String.fromCharCode(from)}-${String.fromCharCode(to)}`,
  ).join('');
  return `[${ranges}]`;
}

const CONTROL_CHARS = new RegExp(controlClass(), 'g');

const ELLIPSIS = '\u2026';

/** Retire les séquences d'échappement d'une chaîne, sans la tronquer. */
export function stripEscapes(raw: string): string {
  return raw.replace(ANSI_OSC, '').replace(ANSI_CSI, '').replace(ANSI_OTHER, '').replace(ANSI_LONE, '');
}

/** Tronque une ligne démesurée en gardant une marque visible de troncature. */
export function truncateLine(text: string, limit: number = MAX_LINE_CHARS): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}${ELLIPSIS}`;
}

/**
 * Nettoie une ligne de diff : plus d'échappement, plus de caractère de contrôle,
 * longueur bornée. Les tabulations sont conservées (indentation lisible).
 */
export function sanitizeText(raw: string): string {
  return truncateLine(stripEscapes(raw).replace(CONTROL_CHARS, '?'));
}

/** Nettoie un chemin de fichier lu dans un diff (mêmes règles, borne plus large). */
export function sanitizePath(raw: string): string {
  const cleaned = stripEscapes(raw).replace(CONTROL_CHARS, '?');
  return truncateLine(cleaned, MAX_PATH_CHARS);
}
