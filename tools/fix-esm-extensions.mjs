#!/usr/bin/env node
/**
 * Réécriture des spécifiants relatifs pour Node ESM.
 *
 * Les sources du dépôt utilisent la convention « import relatif SANS
 * extension » (résolution Bundler, PR #34) : `import { x } from './x'`.
 * `tsc` ne réécrit jamais un spécificateur, et Node ESM exige l'extension
 * exacte (`./x.js`). Ce script fait donc le travail que le compilateur ne
 * fait pas : il ajoute `.js` (ou `/index.js`) aux spécifiants relatifs des
 * fichiers émis (`.js` et `.d.ts`).
 *
 * Usage : `node tools/fix-esm-extensions.mjs <dossier-dist>`
 *
 * Le script est idempotent : un spécificateur déjà terminé par `.js` est
 * laissé tel quel.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

/** Positions où un spécificateur de module peut apparaître. */
const SPECIFIQUEUR = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])(\.{1,2}\/[^'"\n]*)\2/g;

const EXTENSIONS = ['.js', '.d.ts'];

/** Liste récursive des fichiers d'un dossier. */
function listerFichiers(dossier) {
  const trouves = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) trouves.push(...listerFichiers(chemin));
    else trouves.push(chemin);
  }
  return trouves;
}

/** Un chemin existe-t-il et est-il un fichier ? */
function estFichier(chemin) {
  return existsSync(chemin) && statSync(chemin).isFile();
}

/**
 * Cherche la cible d'un spécificateur relatif dans le dossier construit.
 * Renvoie le chemin absolu, ou `null` si rien ne correspond.
 */
function resoudre(specificateur, dossierFichier) {
  const base = join(dossierFichier, specificateur);
  const candidats = [base, `${base}.js`, join(base, 'index.js')];
  for (const candidat of candidats) {
    if (estFichier(candidat)) return candidat;
  }
  return null;
}

/** Transforme un chemin absolu en spécificateur relatif prefixed. */
function enSpecifier(cible, dossierFichier) {
  let relatif = relative(dossierFichier, cible).split(sep).join('/');
  if (!relatif.startsWith('.')) relatif = `./${relatif}`;
  return relatif;
}

/** Réécrit les spécificateurs d'un fichier ; renvoie la liste des échecs. */
function reecrireFichier(chemin, echecs) {
  const source = readFileSync(chemin, 'utf8');
  const dossier = dirname(chemin);
  const reecrit = source.replace(SPECIFIQUEUR, (ensemble, prefixe, quote, specificateur) => {
    const cible = resoudre(specificateur, dossier);
    if (!cible) {
      echecs.push(`${chemin} : ${specificateur}`);
      return ensemble;
    }
    return `${prefixe}${quote}${enSpecifier(cible, dossier)}${quote}`;
  });
  if (reecrit !== source) writeFileSync(chemin, reecrit, 'utf8');
}

/** Point d'entrée : réécrit tous les `.js` et `.d.ts` du dossier donné. */
export function reecrire(dossier) {
  const echecs = [];
  let reecrits = 0;
  for (const chemin of listerFichiers(dossier)) {
    if (!EXTENSIONS.some((extension) => chemin.endsWith(extension))) continue;
    const avant = readFileSync(chemin, 'utf8');
    reecrireFichier(chemin, echecs);
    if (readFileSync(chemin, 'utf8') !== avant) reecrits += 1;
  }
  return { reecrits, echecs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dossier = process.argv[2];
  if (!dossier) {
    console.error('usage : node tools/fix-esm-extensions.mjs <dossier-dist>');
    process.exit(2);
  }
  const { reecrits, echecs } = reecrire(dossier);
  console.log(`fix-esm-extensions : ${reecrits} fichier(s) réécrit(s) dans ${basename(dossier)}`);
  if (echecs.length > 0) {
    console.error('Spécificateurs non résolus (import non valide pour Node ESM) :');
    for (const echec of echecs) console.error(`  - ${echec}`);
    process.exit(1);
  }
}
