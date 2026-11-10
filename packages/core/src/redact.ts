import { createHmac } from 'node:crypto';

/**
 * Calcule l'empreinte HMAC-SHA-256 d'une valeur secrète avec un sel donné.
 * Permet d'identifier, regrouper et ignorer un secret sans jamais stocker sa valeur brute.
 */
export function computeFingerprint(value: string, salt: string): string {
  const hmac = createHmac('sha256', salt);
  hmac.update(value.trim());
  return `hmac256:${hmac.digest('hex').slice(0, 32)}`;
}

/**
 * Génère un aperçu caviardé sûr (ex: 'AKIA...(20)' ou 'j***@e***.com').
 */
export function redactPreview(value: string, family: string): string {
  const trimmed = value.trim();
  const len = trimmed.length;

  if (family === 'cloud-key' || family === 'platform-token') {
    const prefix = trimmed.slice(0, Math.min(4, len));
    return `${prefix}…(${len})`;
  }

  if (family === 'identity' && trimmed.includes('@')) {
    const parts = trimmed.split('@');
    const user = parts[0] ?? '';
    const domain = parts[1] ?? '';
    return `${user.slice(0, 1)}***@${domain.slice(0, 1)}***`;
  }

  if (family === 'bank-data') {
    return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
  }

  return `[REDACTED:${family}](${len})`;
}

/**
 * Caviarde un extrait de ligne de contexte entourant une trouvaille.
 */
export function sanitizeSnippet(line: string, secretValue: string, family: string): string {
  if (!secretValue) return line;
  const placeholder = `[REDACTED:${family}]`;
  return line.replaceAll(secretValue, placeholder);
}
