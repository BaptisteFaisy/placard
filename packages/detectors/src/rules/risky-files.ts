import type { DetectorRule } from '@placard/core';

/**
 * Famille `risky-file` : fichiers à risque, **par nom** (PLA-F-04).
 *
 * Ces règles ne lisent pas la ligne : leur `pattern` s'applique au chemin, et
 * c'est `DetectorEngine.scanPath` qui les exécute. Le groupe 1, quand il existe,
 * désigne la partie du chemin mise en avant (le nom de fichier).
 *
 * Le volet « par contenu » (fichier contenant plus de 50 adresses e-mail) est
 * une règle **de fichier** : elle ne peut pas se décider sur une ligne isolée.
 * Elle vit dans `FILE_LEVEL_RULES` et `scanFile` (`block-scan.ts`) l'évalue.
 */

/** Nombre d'adresses au-delà duquel un fichier est un export de données personnelles. */
export const EMAIL_DUMP_THRESHOLD = 50;

/** Fichier d'environnement, y compris ses variantes (`.env.local`, `.env.prod`). */
const DOTENV = /(?:^|\/)(\.env(?:\.[^/]*)?)$/i;

/** Clé privée ou magasin de clés désigné par son nom. */
const PRIVATE_KEY_FILE =
  /(?:^|\/)(id_(?:rsa|dsa|ecdsa|ed25519))$|(?:^|\/)([^/]*\.(?:pem|key|p12|pfx|jks|keystore|ppk))$/i;

/** Fichier de secrets applicatifs. */
const CREDENTIALS_FILE =
  /(?:^|\/)((?:credentials|secrets?|passwords?)\.(?:json|ya?ml|txt|ini|conf|xml))$/i;

/** Export de base de données (dump SQL ou fichier SQLite). */
const DB_EXPORT_FILE = /(?:^|\/)([^/]*\.(?:sql|dump|sqlite3?|mdb))$/i;

/** Copie de sauvegarde posée à la main dans le dépôt. */
const BACKUP_FILE = /(?:^|\/)([^/]*\.(?:bak|backup|old|orig|save))$/i;

/** Fichiers d'identifiants d'outils (npm, netrc, pgpass, htpasswd, git, docker). */
const TOOL_CREDENTIALS_FILE =
  /(?:^|\/)(\.(?:npmrc|netrc|pgpass|htpasswd|git-credentials|dockercfg))$|(?:^|\/)(docker\/config\.json)$/i;

/** Identifiants stables des règles de fichier. */
export const RULE_RISKY_DOTENV = 'risky-file-dotenv';
export const RULE_RISKY_PRIVATE_KEY_FILE = 'risky-file-private-key';
export const RULE_RISKY_CREDENTIALS = 'risky-file-credentials';
export const RULE_RISKY_DB_EXPORT = 'risky-file-db-export';
export const RULE_RISKY_BACKUP = 'risky-file-backup';
export const RULE_RISKY_TOOL_CREDENTIALS = 'risky-file-tool-credentials';
export const RULE_RISKY_EMAIL_DUMP = 'risky-file-email-dump';

/**
 * Règles de chemin. `keywords` filtre le chemin avant le motif : un chemin qui
 * ne contient même pas le mot-clé ne coûte qu'une comparaison de sous-chaîne.
 */
export const riskyFilePathRules: readonly DetectorRule[] = [
  {
    id: RULE_RISKY_DOTENV,
    family: 'risky-file',
    name: 'Environment file',
    keywords: ['.env'],
    pattern: DOTENV,
    priority: 52,
  },
  {
    id: RULE_RISKY_PRIVATE_KEY_FILE,
    family: 'risky-file',
    name: 'Private key or key store file',
    keywords: [
      'id_rsa',
      'id_dsa',
      'id_ecdsa',
      'id_ed25519',
      '.pem',
      '.key',
      '.p12',
      '.pfx',
      '.jks',
      '.keystore',
      '.ppk',
    ],
    pattern: PRIVATE_KEY_FILE,
    priority: 55,
  },
  {
    id: RULE_RISKY_CREDENTIALS,
    family: 'risky-file',
    name: 'Credentials or secrets file',
    keywords: ['credentials', 'secret', 'password'],
    pattern: CREDENTIALS_FILE,
    priority: 54,
  },
  {
    id: RULE_RISKY_DB_EXPORT,
    family: 'risky-file',
    name: 'Database export',
    keywords: ['.sql', '.dump', '.sqlite', '.mdb'],
    pattern: DB_EXPORT_FILE,
    priority: 50,
  },
  {
    id: RULE_RISKY_BACKUP,
    family: 'risky-file',
    name: 'Backup copy',
    keywords: ['.bak', '.backup', '.old', '.orig', '.save'],
    pattern: BACKUP_FILE,
    priority: 45,
  },
  {
    id: RULE_RISKY_TOOL_CREDENTIALS,
    family: 'risky-file',
    name: 'Tool credentials file',
    keywords: [
      '.npmrc',
      '.netrc',
      '.pgpass',
      '.htpasswd',
      '.git-credentials',
      '.dockercfg',
      'docker/config',
    ],
    pattern: TOOL_CREDENTIALS_FILE,
    priority: 56,
  },
];

/** Règles évaluées sur le fichier entier, jamais sur une ligne seule. */
export const riskyFileLevelRules: readonly DetectorRule[] = [
  {
    id: RULE_RISKY_EMAIL_DUMP,
    family: 'risky-file',
    name: 'File containing more than 50 email addresses',
    keywords: ['@'],
    // Motif de repérage indicatif : la décision se prend sur le comptage de
    // `scanFile`, jamais sur une ligne isolée.
    pattern: /@/,
    priority: 51,
  },
];
