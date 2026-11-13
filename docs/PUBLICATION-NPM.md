# Publication npm des paquets partagés

Cahier des charges §21 : `@placard/detectors`, `@placard/analysis` et
`@placard/core` doivent être **publiables** pour que les applications sœurs
(placard-wiki, tickets-pieges, gammes…) consomment **une seule
implémentation**, jamais une copie.

Ce document décrit la stratégie retenue, les commandes, et ce qui reste
manuel (compte npm, scope, token).

---

## 1. La décision centrale : ESM publié, pas CJS

Les paquets sont publiés en **ESM** (`"type": "module"`), avec les types
TypeScript embarqués. Le format CJS a été écarté : le dépôt, ses applications
et son bundler (Vite, webpack de Forge) sont déjà ESM, et publier en CJS
imposerait un double jeu de fichiers (`exports` imbriqués `import`/`require`),
donc deux surfaces à maintenir et à faire diverger.

Le point technique qui decide de tout le reste : **les sources du dépôt
utilisent la convention « import relatif sans extension »** (résolution
Bundler, PR #34) :

```ts
import { groupDetections } from './group';   // dans les sources
```

Node ESM, lui, exige l'extension exacte :

```js
import { groupDetections } from './group.js'; // dans le paquet publié
```

`tsc` ne réécrit jamais un spécificateur. Trois voies possibles :

| Option | Verdict |
|---|---|
| (a) émettre des imports **avec** extension | **retenue** — post-traitement déterministe après `tsc` |
| (b) publier en CJS | écartée — double surface, divergence avec le dépôt |
| (c) bundler (`tsup`, `esbuild`) | écartée — le code de `@placard/core` serait embarqué **en copie** dans chaque paquet, ce que §21 interdit explicitement |

Le post-traitement est `tools/fix-esm-extensions.mjs` : il parcourt le
`dist/` produit et ajoute `.js` (ou `/index.js`) aux seuls spécificateurs
**relatifs** ; les spécificateurs nus (`@placard/core`) sont laissés tels
quels, ce qui préserve la dépendance npm ordinaire entre paquets publiés.

---

## 2. Deux manifestes, une seule source de vérité

Le manifeste du dépôt (`packages/<p>/package.json`) et le manifeste **publié**
ne sont pas le même fichier, et c'est délibéré.

Le dépôt consomme ses paquets comme **sources** : placard-wiki consomme le
sous-module `vendor/placard`, son `tsconfig` pointe sur
`vendor/placard/packages/<p>/src/index.ts` et son bundle Forge résout le
paquet par son `main`. Basculer le `main` du dépôt vers `dist/` casserait le
build des applications sœurs, qui ne construisent pas le sous-module.

Conséquence : le manifeste du dépôt garde `main: ./src/index.ts` et n'a pas
de champ `exports` (un `exports` est prioritaire sur `main` et pointerait
vers un `dist/` absent du sous-module).

Le manifeste publié est donc **généré au moment du pack** par
`tools/prepare-publish.mjs` :

```jsonc
{
  "name": "@placard/detectors",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "src", "README.md", "LICENSE"],
  "publishConfig": { "access": "public" },
  "dependencies": { "@placard/core": "^0.1.0" }
}
```

Le bloc `publish` du manifeste du dépôt est l'unique source de vérité pour
les points d'entrée publiés ; le générateur remplace aussi les dépendances
`workspace:*` par de vraies plages npm (`^<version>`).

---

## 3. Construction

```bash
pnpm build:paquets     # tsc + réécriture des extensions, dans l'ordre topologique
```

Chaque paquet a son `tsconfig.build.json` : ESM, déclarations, `target`
ES2022, `rootDir: src`, `outDir: dist`, tests exclus. Le paquet cœur est
construit d'abord (`pnpm -r` respecte le graphe de dépendances), et les
paquets consommateurs résolvent `@placard/core` par ses **déclarations
construites** (`packages/core/dist/index.d.ts`) : le code du cœur n'est jamais
copié.

La construction complète (`pnpm build`) dure quelques secondes : le budget CI
de 5 minutes par job reste respecté.

---

## 4. Publier

```bash
tools/publish.sh --dry-run     # vérifie tout, ne publie rien
tools/publish.sh               # publie les quatre paquets cœur
tools/publish.sh detectors     # publie un sous-ensemble
```

Le script refuse de publier si :

- l'arbre de travail est sale (le paquet publié doit correspondre à un
  commit) ;
- `npm whoami` ne répond pas (aucun compte npm configuré) ;
- la version demandée existe déjà sur le registre ;
- le paquet préparé n'est pas publiable (`tools/check-publishable.mjs`,
  également câblé en `prepublishOnly`).

Il n'est appelé par **aucun** autre script ni job de CI : la CI se contente
de vérifier que les paquets sont publiables.

### Workflow de release

`.github/workflows/release.yml`, déclenché par un tag `v*` :

1. `build` — construit, prépare, vérifie chaque paquet (`check-publishable`
   + `npm pack --dry-run`) et archive le résultat ;
2. `publish` — publie **seulement** les paquets dont la version correspond au
   tag (et qui ne sont pas déjà sur le registre), avec `NODE_AUTH_TOKEN`, puis
   crée le tag GitHub.

---

## 5. Ce qui reste manuel (compte npm)

- créer un compte npm (ou une organisation) disposant du **scope `@placard`** ;
- publier le premier paquet en accès public si le scope n'est pas déjà public
  (`npm access publish` côté compte) ;
- créer un **Automation token** npm et le déposer dans le secret GitHub
  `NODE_AUTH_TOKEN` du dépôt `BaptisteFaisy/placard` ;
- pousser le tag : `git tag v0.1.0 && git push origin v0.1.0`.

Aucune de ces étapes n'est automatisable depuis le dépôt : elles dépendent
d'un compte npm qui n'existe pas encore.

---

## 6. Ce qu'un tiers peut faire après `npm i @placard/detectors`

```ts
import { createDetectorEngine } from '@placard/detectors';

const moteur = createDetectorEngine();
const resultat = moteur.scanLine({
  line: 'const aws = "AKIAIOSFODNN7EXAMPLE";',
  path: 'src/config.ts',
  commit: 'abc123',
  lineNumber: 1,
  side: 'added',
});

console.log(resultat.detections.map((d) => d.rule)); // ['cloud-access-key-id']
```

Les types sont inclus (`@placard/core` ships ses `.d.ts`), le paquet est
ESM, et `@placard/core` arrive comme dépendance npm ordinaire : **une seule
implémentation** du noyau, partagée par tous les consommateurs.

---

## 7. Fichiers concernés

| Chemin | Rôle |
|---|---|
| `packages/<p>/package.json` | métadonnées de publication, bloc `publish`, script `build` |
| `packages/<p>/tsconfig.build.json` | construction ESM + déclarations |
| `packages/<p>/README.md` | installation, usage, API publique, licence |
| `tools/fix-esm-extensions.mjs` | réécriture des spécificateurs pour Node ESM |
| `tools/prepare-publish.mjs` | génération du manifeste publié et de l'archive |
| `tools/check-publishable.mjs` | garde-fou `prepublishOnly` |
| `tools/publish.sh` | publication en une commande, avec garde-fous |
| `.github/workflows/release.yml` | publication déclenchée par un tag |
