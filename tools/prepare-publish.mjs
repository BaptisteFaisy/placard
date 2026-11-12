#!/usr/bin/env node
/**
 * Prépare les paquets publiables sur npm.
 *
 * Pourquoi un manifeste séparé de celui du dépôt ?
 * Le dépôt consomme ses paquets comme SOURCES : placard-wiki consomme le
 * sous-module `vendor/placard` et pointe sur `packages/<p>/src/index.ts`. Le
 * manifeste du dépôt doit donc rester orienté sources, sinon le build des
 * apps sœurs casse (elles ne construisent pas le sous-module).
 * Le manifeste PUBLIÉ est construit au moment du `pack` : il expose `dist/`
 * (ESM + déclarations) via `exports` et remplace les dépendances
 * `workspace:*` par de vraies versions npm.
 *
 * Sortie : `.publish/<nom du paquet>/` — package.json généré, `dist/`,
 * README.md et LICENSE. `.publish/` est ignoré par Git.
 *
 * Usage : node tools/prepare-publish.mjs [--all] [paquet...]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOSSIER_PUBLICATION = join(RACINE, '.publish');

/** Les quatre paquets cœur publiables (cahier des charges §21). */
export const PAQUETS_PUBLIES = ['core', 'detectors', 'analysis', 'ritual'];

/** Lit un fichier JSON et renvoie son contenu analysé. */
export function lireJson(chemin) {
  return JSON.parse(readFileSync(chemin, 'utf8'));
}

/** Versions de tous les paquets de l'espace de travail. */
export function versionsEspaceTravail() {
  const versions = {};
  for (const paquet of PAQUETS_PUBLIES) {
    const manifeste = lireJson(join(RACINE, 'packages', paquet, 'package.json'));
    versions[manifeste.name] = manifeste.version;
  }
  return versions;
}

/**
 * Remplace les dépendances `workspace:*` par une plage npm
 * (`^<version>`) : le paquet publié dépend du paquet publié, jamais d'un
 * lien vers l'espace de travail.
 */
export function dependancesPubliees(dependances, versions) {
  const publiees = {};
  for (const [nom, plage] of Object.entries(dependances ?? {})) {
    if (plage.startsWith('workspace:')) {
      const version = versions[nom];
      if (!version) throw new Error(`Version inconnue pour la dépendance ${nom}`);
      publiees[nom] = `^${version}`;
    } else {
      publiees[nom] = plage;
    }
  }
  return publiees;
}

/** Construit le manifeste publié à partir du manifeste du dépôt. */
export function manifestePublie(manifeste, versions) {
  const publication = manifeste.publish;
  if (!publication) throw new Error(`Manifeste sans bloc « publish » : ${manifeste.name}`);
  return {
    name: manifeste.name,
    version: manifeste.version,
    description: manifeste.description,
    license: manifeste.license,
    type: manifeste.type ?? 'module',
    sideEffects: manifeste.sideEffects ?? false,
    main: publication.main,
    module: publication.module,
    types: publication.types,
    exports: publication.exports,
    files: manifeste.files ?? publication.files,
    publishConfig: manifeste.publishConfig ?? { access: 'public' },
    repository: manifeste.repository,
    bugs: manifeste.bugs,
    homepage: manifeste.homepage,
    keywords: manifeste.keywords,
    engines: manifeste.engines,
    dependencies: dependancesPubliees(manifeste.dependencies, versions),
    scripts: { prepublishOnly: 'node ../../tools/check-publishable.mjs' },
  };
}

/** Copie le paquet construit dans `.publish/<nom>/`. */
export function preparerPaquet(paquet, versions) {
  const source = join(RACINE, 'packages', paquet);
  const manifeste = lireJson(join(source, 'package.json'));
  const cible = join(DOSSIER_PUBLICATION, manifeste.name);
  const construit = join(source, 'dist');
  if (!existsSync(construit)) {
    throw new Error(`Build manquant pour ${manifeste.name} — lancez « pnpm build:paquets »`);
  }
  const readme = join(source, 'README.md');
  if (!existsSync(readme)) throw new Error(`README manquant pour ${manifeste.name}`);
  rmSync(cible, { recursive: true, force: true });
  mkdirSync(cible, { recursive: true });
  cpSync(construit, join(cible, 'dist'), { recursive: true });
  cpSync(readme, join(cible, 'README.md'));
  cpSync(join(RACINE, 'LICENSE'), join(cible, 'LICENSE'));
  const publie = manifestePublie(manifeste, versions);
  writeFileSync(join(cible, 'package.json'), `${JSON.stringify(publie, null, 2)}\n`, 'utf8');
  return { nom: publie.name, version: publie.version, dossier: cible };
}

/** Point d'entrée : prépare les paquets demandés. */
function principal(argv) {
  const demandes = argv.filter((argument) => !argument.startsWith('--'));
  const paquets = demandes.length > 0 ? demandes : PAQUETS_PUBLIES;
  for (const paquet of paquets) {
    if (!PAQUETS_PUBLIES.includes(paquet)) throw new Error(`Paquet non publiable : ${paquet}`);
  }
  const versions = versionsEspaceTravail();
  for (const paquet of paquets) {
    const prepare = preparerPaquet(paquet, versions);
    console.log(`préparé : ${prepare.nom}@${prepare.version} → ${prepare.dossier}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    principal(process.argv.slice(2));
  } catch (erreur) {
    console.error(`prepare-publish : ${erreur.message}`);
    process.exit(1);
  }
}
