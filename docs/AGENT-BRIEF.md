# Brief agent — contribuer à un lot Placard

Ce fichier est le contrat commun à tous les sous-agents qui construisent Placard.
Il est **en lecture seule** : ne le modifie jamais.

## 1. Le projet

Placard (« Skeletons in the Closet ») fouille l'historique Git à la recherche de
secrets et de données personnelles oubliés, les présente dans un manoir hanté où
chaque élément du décor code une donnée réelle, et guide la remédiation dans le
bon ordre (rotation → purge → prévention → vérification).

Soumission au hackathon Kiroween 2026, catégorie **Costume Contest**. Dépôt
public, licence MIT, interface et textes visibles **en anglais**.

## 2. Architecture

Monorepo pnpm, TypeScript strict, Node 22, Vitest + fast-check.

| Paquet | Rôle |
|---|---|
| `@placard/core` | **Contrats et vocabulaire partagés. Déjà écrit, ne pas modifier.** |
| `@placard/git-history` | Lecture en flux de l'historique Git (commits, diffs, fichiers ignorés) |
| `@placard/detectors` | Règles par famille, préfiltre par mots-clés, validations (Luhn, mod 97, entropie) |
| `@placard/analysis` | Regroupement par empreinte, durée de vie, score, exclusions, rapport |
| `@placard/demo-repo` | Générateur de dépôt hanté à graine fixe (oracle de test + démo) |
| `@placard/ritual` | Fiches de rotation, verrou d'ordre, script de purge, prévention, certificat |
| `@placard/manor-model` | Modèle de présentation partagé manoir + registre (étages, portes, empreintes de pas) |
| `@placard/cli` | Commandes `scan`, `serve`, `ritual`, `demo`, `selftest` |
| `@placard/ui` | Composants React : manoir SVG, registre, hall, rituel |
| `@placard/web` | Application Vite : démo hébergée + dépôt d'un rapport local |

**Tout ce qui est partagé vit dans `@placard/core`** : types, schéma Zod du
rapport, empreinte HMAC, caviardage, score de danger, gravité, vocabulaire
i18n, contrats d'interface de chaque paquet (`packages/core/src/contracts/*.ts`).
Commence par lire le contrat de ton paquet : c'est l'interface que tu dois
implémenter, à la signature près.

## 3. Règles dures (bloquantes en CI)

1. **Taille** : aucun fichier de plus de **500 lignes**, aucune fonction de plus
   de **50 lignes** (ESLint `max-lines` / `max-lines-per-function` en erreur).
   Découpe en modules et helpers plutôt que d'alléger la règle.
2. **Zéro duplication** : réutilise `@placard/core`. Une logique = une
   implémentation.
3. **Imports** : les imports relatifs se terminent par `.js`
   (`import { x } from './x.js';`) — résolution NodeNext. Les imports de paquet
   passent par `@placard/core`.
4. **TypeScript strict** avec `noUncheckedIndexedAccess` : tout index peut être
   `undefined`, à traiter explicitement. Aucun `any` (`@typescript-eslint/no-explicit-any`
   en erreur).
5. **Aucun secret dans le dépôt** (PLA-N-09) : aucune valeur au format réel d'un
   secret — même factice — n'est écrite dans un fichier du dépôt. Les valeurs de
   test sont **fabriquées à l'exécution** (graine + générateur). Le job `kiro`
   et le scan auto du dépôt vérifient cette règle.
6. **Non-divulgation** (PLA-N-02) : aucune valeur détectée ne sort du moteur —
   ni dans un rapport, ni dans un journal, ni dans une erreur. Utilise
   `computeFingerprint`, `redactPreview` et `sanitizeSnippet` de `@placard/core`.
7. **Langue** : chaînes visibles par l'utilisateur en **anglais** ; commentaires
   de code en français bienvenus.
8. **Périmètre** : tu n'écris que dans `packages/<ton-lot>/`. Ne touche jamais
   `package.json` racine, `pnpm-lock.yaml`, `tsconfig*.json`, `vitest.config.ts`,
   `eslint.config.js`, `.github/`, `.kiro/`, `README.md`, ni un autre paquet. Si
   tu penses devoir le faire : ne le fais pas, signale-le dans ton compte rendu.
9. **Dépendances** : aucune dépendance nouvelle. Celles de ton paquet sont déjà
   déclarées dans son `package.json`.
10. **Tests** : chaque lot livre ses tests (`packages/<lot>/src/*.test.ts`), y
    compris les tests par propriétés fast-check quand le cahier des charges en
    liste pour ton lot.
11. **Accessibilité** (lots ui/web) : niveau AA, information jamais portée par
    la seule couleur, navigation clavier complète, `prefers-reduced-motion`
    respecté, aucun son.
12. **Fais le travail toi-même** : ne délègue pas à un autre agent.

## 4. Environnement de travail

```bash
export PATH=/home/baptiste/.local/opt/bin:$PATH   # pnpm 9.15.9
cd <ton-worktree>
pnpm install --frozen-lockfile                     # une fois
pnpm typecheck                                     # tsc sur tout le monorepo
pnpm lint                                          # eslint sur tout le monorepo
pnpm vitest run packages/<ton-lot>                 # tests de ton lot
pnpm test                                          # tous les tests (facultatif, long)
```

`pnpm typecheck` et `pnpm lint` portent sur tout le monorepo : ignore les
erreurs qui proviennent d'un autre paquet (elles disparaîtront quand les autres
lots seront mergés), mais **ton** paquet doit être propre.

Git : chaque commit Git créé par tes tests doit passer par des variables
d'environnement (`GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`,
`GIT_COMMITTER_EMAIL`) et `git init -b main`, dans un dossier temporaire
(`fs.mkdtemp`). Ne dépende jamais de la configuration Git globale.

## 5. Livraison

1. Travail dans un worktree dédié, branche `feat/<lot>`, basée sur `origin/main`.
2. Commits petits et lisibles, messages en anglais.
3. `git push -u origin feat/<lot>` puis
   `gh pr create --base main --title "<type>(<lot>): <sujet>" --body "..."`.
4. Le corps de la PR contient une section `## Scope` listant les fichiers touchés,
   et une section `## Vérifications` avec les commandes lancées et leur résultat.
5. **Ne jamais merger** : c'est la file Mergify qui merge, une fois la CI verte.
6. Compte rendu final : numéro de PR, ce qui est implémenté, exigences du cahier
   couvertes, écarts assumés, toute modification hors périmètre que tu aurais
   jugée nécessaire (sans l'avoir faite).

## 6. Bornes

- Temps cible : reste dans ton lot, ne perfectionne pas au-delà du contrat.
- Après **3 échecs identiques** sur la même commande : arrête, laisse l'état tel
  quel, et réponds `KO` avec l'erreur exacte recopiée.
- Si une exigence du contrat te semble impossible : implémente le reste, et
  signale le point bloquant dans le compte rendu plutôt que de modifier le contrat.
