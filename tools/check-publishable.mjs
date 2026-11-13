#!/usr/bin/env node
/**
 * Garde-fou `prepublishOnly` : vérifie qu'un paquet préparé est réellement
 * publiable (manifeste complet, fichiers d'entrée présents, aucune
 * dépendance `workspace:` résiduelle).
 *
 * Le script s'exécute dans le dossier du paquet à publier (`.publish/<nom>/`).
 * Usage : node tools/check-publishable.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DOSSIER = process.cwd();

/** Lit le manifeste du paquet à publier. */
function lireManifeste() {
  const chemin = join(DOSSIER, 'package.json');
  if (!existsSync(chemin)) throw new Error('package.json absent');
  return JSON.parse(readFileSync(chemin, 'utf8'));
}

/**
 * Liste les fichiers référencés par `exports` (récursif).
 * Dans un `exports`, la valeur d'une condition est toujours un chemin relatif
 * à la racine du paquet : les clés (sous-chemins) ne jouent pas ici.
 */
function ciblesExports(exports) {
  const cibles = [];
  if (typeof exports === 'string') {
    cibles.push(exports);
    return cibles;
  }
  if (Array.isArray(exports)) {
    for (const entree of exports) cibles.push(...ciblesExports(entree));
    return cibles;
  }
  for (const valeur of Object.values(exports ?? {})) cibles.push(...ciblesExports(valeur));
  return cibles;
}

/** Vérifie qu'un chemin relatif existe dans le dossier du paquet. */
function existe(chemin) {
  return existsSync(resolve(DOSSIER, chemin));
}

/** Contrôles de structure du manifeste. */
function controlerManifeste(manifeste, erreurs) {
  if (!manifeste.name?.startsWith('@placard/')) erreurs.push('nom de paquet inattendu');
  if (!manifeste.version) erreurs.push('version absente');
  if (manifeste.private === true) erreurs.push('« private: true » interdit');
  if (manifeste.license !== 'MIT') erreurs.push('licence absente ou non MIT');
  if (manifeste.publishConfig?.access !== 'public') erreurs.push('publishConfig.access doit valoir « public »');
  if (!manifeste.exports?.['.']) erreurs.push('exports["."] absent');
  if (!manifeste.files?.length) erreurs.push('« files » absent');
  for (const champ of ['main', 'module', 'types']) {
    if (!manifeste[champ]) erreurs.push(`« ${champ} » absent`);
    else if (!existe(manifeste[champ])) erreurs.push(`« ${champ} » ne pointe pas sur un fichier : ${manifeste[champ]}`);
  }
  for (const cible of ciblesExports(manifeste.exports)) {
    if (!existe(cible)) erreurs.push(`exports pointe sur un fichier absent : ${cible}`);
  }
}

/** Contrôles de contenu (dépendances, documentation, licence). */
function controlerContenu(manifeste, erreurs) {
  for (const [nom, plage] of Object.entries(manifeste.dependencies ?? {})) {
    if (plage.startsWith('workspace:')) erreurs.push(`dépendance « workspace: » résiduelle : ${nom}`);
  }
  for (const fichier of ['README.md', 'LICENSE']) {
    if (!existe(fichier)) erreurs.push(`${fichier} absent du paquet`);
  }
}

/** Point d'entrée : rapporte les anomalies et(code de sortie). */
function principal() {
  const erreurs = [];
  let manifeste;
  try {
    manifeste = lireManifeste();
  } catch (erreur) {
    console.error(`check-publishable : ${erreur.message}`);
    process.exit(1);
  }
  controlerManifeste(manifeste, erreurs);
  controlerContenu(manifeste, erreurs);
  if (erreurs.length > 0) {
    console.error('check-publishable : paquet NON publiable');
    for (const erreur of erreurs) console.error(`  - ${erreur}`);
    process.exit(1);
  }
  console.log(`check-publishable : ${manifeste.name}@${manifeste.version} publiable (${manifeste.license})`);
}

principal();
