/**
 * Sommes de contrôle et mesures partagées.
 *
 * Une seule implémentation pour tout le monorepo : les détecteurs s'en servent
 * pour **valider** une valeur trouvée, le générateur de valeurs factices s'en
 * sert pour **fabriquer** une valeur valide (PLA-P-04). Aucune valeur au
 * format réel d'un secret n'est écrite ici (PLA-N-09).
 */

/** Somme de contrôle de Luhn : vraie si le numéro est valide. */
export function luhnValid(digits: string): boolean {
  const clean = digits.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(clean) || clean.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    const digit = Number(clean[i]);
    if (Number.isNaN(digit)) return false;
    let value = digit;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Modulo 97 bancaire (ISO 7064) : `value mod 97 === 1` pour un IBAN valide.
 * Accepte les espaces comme séparateurs.
 */
export function mod97Valid(iban: string): boolean {
  const compact = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(compact)) return false;
  const rearranged = `${compact.slice(4)}${compact.slice(0, 4)}`;
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return mod97OfDigits(numeric) === 1;
}

/** Modulo 97 d'une chaîne de chiffres de longueur arbitraire. */
export function mod97OfDigits(digits: string): number {
  let remainder = 0;
  for (const char of digits) {
    remainder = (remainder * 10 + Number(char)) % 97;
  }
  return remainder;
}

/**
 * Clé d'un numéro de sécurité sociale français (NIR, 13 chiffres + clé 2).
 * Retourne la clé attendue (00 à 96), ou `undefined` si l'entrée est invalide.
 * Corse : `2A` → 19, `2B` → 18 avant le modulo.
 */
export function nirKey(nir13: string): number | undefined {
  const compact = nir13.replace(/\s+/g, '').toUpperCase();
  if (!/^\d{12}[0-9AB]$/.test(compact)) return undefined;
  const normalized = compact.replace('A', '19').replace('B', '18');
  if (!/^\d{13}$/.test(normalized)) return undefined;
  const key = 97 - (Number(normalized) % 97);
  return Number.isFinite(key) ? key : undefined;
}

/** Le NIR complet (13 chiffres + clé 2) est-il valide ? */
export function nirValid(nir15: string): boolean {
  const compact = nir15.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length !== 15) return false;
  const body = compact.slice(0, 13);
  const key = compact.slice(13);
  if (!/^\d{2}$/.test(key)) return false;
  return nirKey(body) === Number(key);
}

/** Entropie de Shannon d'une chaîne, en bits par caractère. */
export function shannonEntropy(text: string): number {
  if (text.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const char of text) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Motifs de valeurs factices connues (jamais de littéral au format réel). */
const DUMMY_PATTERNS: readonly RegExp[] = [
  /^(change[_-]?me|changeme|todo|fixme|placeholder|dummy|sample|example|test|testing|fake|none|null|nil|unknown|xxx+|your[_-]?key[_-]?here|insert[_-]?here)$/i,
  /^(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key)$/i,
  /^(1234+|0+|1+|abc+|abcd+|a+b+c+|\*+|\.+|-+|_+)$/i,
  /^(admin|root|user|guest|demo|local|dev|development|staging|production)$/i,
  /^(\d)\1{2,}$/,
  /^(0123456789|1234567890|9876543210|123456789|12345678|1234567|123456)$/,
  /^[^a-zA-Z0-9]*$/,
];

/**
 * La valeur est-elle une valeur factice connue ? Utilisé pour abaisser le score
 * (−20, cahier C.6) et pour écarter le bruit. Reconnaissance par **motifs**,
 * jamais par comparaison à un secret réel.
 */
export function isDummyValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  if (trimmed.length <= 6 && shannonEntropy(trimmed) < 2) return true;
  if (DUMMY_PATTERNS.some((pattern) => pattern.test(trimmed))) return true;
  return shannonEntropy(trimmed) < 2 && /^(?:([a-z0-9])\1)+$/i.test(trimmed);
}

/** Segments de chemin qui signalent un dossier de test ou d'exemple (−30 au score). */
const TEST_PATH_SEGMENTS: readonly string[] = [
  'test',
  'tests',
  '__tests__',
  'spec',
  'specs',
  'example',
  'examples',
  'sample',
  'samples',
  'fixture',
  'fixtures',
  'mock',
  'mocks',
  'stub',
  'stubs',
  'docs',
  'doc',
  'storybook',
  'snapshots',
];

/** Le chemin est-il un dossier de test ou d'exemple (cahier C.6, PLA-P-07) ? */
export function isTestPath(path: string): boolean {
  const segments = path.split('/').filter((segment) => segment.length > 0);
  if (segments.length === 0) return false;
  const dirs = segments.slice(0, -1);
  const lowered = dirs.map((segment) => segment.toLowerCase());
  if (lowered.some((segment) => TEST_PATH_SEGMENTS.includes(segment))) return true;
  const file = (segments[segments.length - 1] ?? '').toLowerCase();
  return /\.(test|spec|example|sample|fixture|mock|stub)\.[a-z0-9]+$/.test(file);
}
