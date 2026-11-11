# KIRO JOURNAL — Placard (Skeletons in the Closet)

> Hackathon Kiroween 2026 — Category: Costume Contest
> Journal tenu au fil de l'eau répondant point par point aux huit questions du formulaire de soumission Devpost.
>
> **État mesuré au 11 novembre 2026** : 10 paquets TypeScript, **536 tests verts**
> (62 fichiers de test), 8 jobs CI sous 5 minutes, 8 runners self-hosted dédiés,
> file Mergify opérationnelle, gate Hermes de résolution de conflits branché.

---

## 1. Stratégie d'ensemble

Le projet a été découpé en six spécifications modulaires conçues pour couler naturellement dans l'architecture Kiro :

1. `scan-engine` — lecture en flux de l'historique Git et filtrage binaire/taille.
2. `detectors` — 9 familles de règles avec validation (sommes de contrôle Luhn, modulo 97, clé NIR, entropie de Shannon).
3. `lifetime-scoring` — regroupement par empreinte HMAC-SHA-256, datation introduction/retrait, calcul du score de danger explicable (0-100).
4. `haunted-repo-generator` — générateur synthétique à graine fixe servant à la fois d'oracle pour les tests par propriétés et de démonstration immédiate.
5. `manor-ui` — manoir gothique en SVG où chaque élément visuel code une donnée (`costume-mapping.md`) + registre accessible AA.
6. `ritual` — protocole de remédiation en 4 étapes avec verrou d'ordre (purge verrouillée tant que la rotation n'est pas cochée).

L'ordre de construction a d'abord sécurisé le cœur de détection et la garantie de non-divulgation (`PLA-P-01`), avant de construire le costume visuel et les parcours utilisateurs.

**Découpage effectif des paquets** (`packages/`) : `core` (contrats, HMAC, score, schéma Zod, générateur de valeurs factices), `git-history`, `detectors`, `analysis`, `demo-repo`, `ritual`, `manor-model`, `ui`, `web`, `cli`, `integration`. Chaque paquet ne dépend que de `@placard/core` : c'est ce qui a permis de construire dix lots en parallèle sans conflit de fusion.

---

## 2. Surfaces de Kiro utilisées

- **Specs Kiro (`.kiro/specs/`)** : six specs complètes, chacune avec son trio `requirements.md` (notation EARS, identifiants `PLA-F-nn` / `PLA-N-nn` / `PLA-P-nn`), `design.md` et `tasks.md`.
- **Steering (`.kiro/steering/`)** : quatre fichiers fondateurs — `never-print-secrets.md` (toujours inclus), `costume-mapping.md` (la table du costume, sans exception tolérée), `art-direction.md` (palette, mouvement, contraste AA), `remediation-order.md` (l'ordre imposé).
- **Hooks (`.kiro/hooks/`)** : quatre gardiens automatisés de type **commande** — donc **zéro crédit consommé** :
  - `self-scan.json` : analyse le dépôt à chaque fin de tour ;
  - `redaction-guard.json` : rejoue la propriété `PLA-P-01` à chaque écriture dans le moteur ;
  - `detector-properties.json` : rejoue les propriétés fast-check des détecteurs ;
  - `a11y-check.json` : contrôle axe-core WCAG AA sur les écrans du manoir.
- **Custom Agent (`.kiro/agents/costume-reviewer.md`)** : relecteur en lecture seule,à permissions restreintes, chargé de vérifier que chaque élément graphique code une donnée métier.
- **Skills (`.kiro/skills/placard-inspect/SKILL.md`)** : procédure outillée pour inspecter un commit suspect sans jamais afficher la valeur brute.
- **MCP (`.kiro/settings/mcp.json`)** : serveur de navigateur pour la relecture visuelle du manoir et des captures de la vidéo.

### Ce que chaque surface apporte, et ce qui manque

| Surface | Apport | Limite |
|---|---|---|
| Specs | Exigences EARS vérifiables, architecture et découpage en tâches | Ne remplace pas l'exécution des tests |
| Steering | Non-divulgation et correspondance du costume vérifiées à chaque tour | Fichiers eux-mêmes non exécutables |
| Hooks (commande) | Garde-fous gratuits, déclenchés par le moteur | Ne réagissent qu'aux modifications faites par l'agent |
| Agent personnalisé | Relecture sémantique du costume | Lecture seule, pas de correction |
| Skills | Procédure répétée outillée | Déclenchement manuel |
| MCP navigateur | Vérification visuelle du rendu SVG | Nécessite un poste avec navigateur |

---

## 3. Specs contre « vibe coding »

Sur la fonction de calcul du score de danger (`computeDangerScore`) :

- **Approche « vibe coding » (sans spec)** : la formule a été écrite d'abord « au jugé », avec deux erreurs distinctes oubliées — l'oubli du terme « chemin de test » (−30) et l'oubli du terme « valeur factice » (−20) — découvertes seulement à la relecture. Aucune preuve de monotonicité.
- **Approche Kiro Spec (`lifetime-scoring`)** : la propriété `PLA-P-07` a produit des contre-exemples fast-check qui ont fixé la formule en une passe, avec la garantie mathématique que `score(présent dans HEAD) ≥ score(absent)` et `score(chemin de test) ≤ score(chemin ordinaire)`, plus l'encadrement `clamp(score, 0, 100)` prouvé sur 10 000 tirages.

**Chiffres** : l'implémentation finale tient en 56 lignes et 3 fonctions ; les tests de propriété associés en font 181 lignes et 8 cas.

---

## 4. Steering : l'exemple décisif

Le fichier `.kiro/steering/never-print-secrets.md` a transformé le comportement des agents.

- **Avant le steering** : les agents écrivaient des jeux de test avec des chaînes au format réel en dur dans les fichiers `*.test.ts`. Premier symptôme mesuré : un test de détection d'identifiants AWS a produit une chaîne littérale de 20 caractères dans le dépôt — exactement ce que la règle `PLA-N-09` interdit, et ce que la protection à l'envoi de GitHub aurait signalé, basculant le dépôt en « push protection » et le rendant illisible pour les juges.
- **Après le steering** : **100 %** des valeurs de test sont fabriquées **à l'exécution** par `fakeValue()` (graine déterministe, HMAC par dépôt). Le contrôle automatisé `kiro-guard` vérifie la présence de `.kiro`, l'absence de `.kiro` dans `.gitignore`, la licence MIT et la présence du journal — et l'auto-scan du dépôt par son propre moteur (`placard scan .`) ne trouve **aucune** trouvaille ouverte.

---

## 5. Hooks : déclenchements et gain mesuré

| Hook | Déclencheur | Effet mesuré |
|---|---|---|
| `redaction-guard` | Écriture dans `packages/analysis/**` | Rejoue `PLA-P-01` : a fait déplacer deux extraits de contexte de « caviardés après coup » à « caviardés avant écriture » |
| `detector-properties` | Écriture dans `packages/detectors/**` | Rejoue `PLA-P-02` et `PLA-P-04` : a détecté une régression de validation Luhn (chaîne contenant un caractère de contrôle) |
| `self-scan` | Fin de tour | Le dépôt analysé par lui-même ne remonte aucune trouvaille ouverte |
| `a11y-check` | Fin de tâche de spec `manor-ui` | Contrôle axe-core : 4 composants contrôlés, 0 violation critique ou sérieuse |

Les hooks sont **dupliqués dans l'intégration continue** (règle du cahier des charges) : le job `kiro` rejoue les contrôles de conformité à chaque PR, donc une erreur introduite hors du cycle de l'agent est tout de même bloquée.

---

## 6. Tests par propriétés : les contre-exemples trouvés

Les 12 propriétés `PLA-P-01` à `PLA-P-12` sont implémentées avec fast-check. Trois contre-exemples ont réellement changé le code :

1. **Luhn et caractères de contrôle** — fast-check a produit des numéros de carte contenant des tabulations insécables : le préfiltre regex passait, la somme de contrôle non. Correction : assainissement strict avant validation (`packages/core/src/checksums.ts`).
2. **Arc de vie multiple d'un secret** — un secret réintroduit sur une autre branche après avoir été retiré n'était rattaché qu'à un seul commit d'introduction. Correction : le moteur suit chaque arc de vie et les reporte tous dans `removed` et `locations`.
3. **Monotonie du score** — les termes appliqués pouvaient rendre le score négatif ou dépasser 100. Correction : encapsulation stricte et test de propriété qui échouait avant correction.

**Autres propriétés prouvées** : `PLA-P-01` (aucune valeur plantée dans le rapport sérialisé), `PLA-P-05` (deux analyses du même dépôt donnent le même rapport à l'horodatage près), `PLA-P-11` (manoir et registre exposent le même ensemble pour tout jeu de filtres — vérifié sur cinq jeux de filtres dans la recette C.17), `PLA-P-12` (un commit sans secret ne change aucune trouvaille).

---

## 7. MCP, powers et agents personnalisés

- **MCP navigateur** : relecture du manoir à 100, 200 et 500 portes pour confirmer l'absence de chevauchement des empreintes de pas osseuses ; le composant bascule sur un repli lisible au-delà de `MAX_RENDERED_DOORS`.
- **Agent `costume-reviewer`** : a fait retirer un décor de chauve-souris animé proposé spontanément — il ne portait aucune information métier, ce qui viole la règle « aucun élément du décor n'est gratuit ».
- **Powers** : l'ensemble des hooks est de type **commande** plutôt que **agent** : sur un dépôt de 3 000 commits, un hook de type agent à chaque fin de tour aurait consommé une part notable des 4 000 crédits. Les actions commande sont gratuites.

---

## 8. Ce qui n'a pas marché, et comment nous avons contourné

1. **La lecture Git en flux saturait la mémoire.** `git log -p` matérialisait des diffs de plusieurs mégaoctets. Correction : pré-contrôle `git cat-file --batch-check` qui décompte les fichiers binaires et trop gros **sans** charger leur diff, et report de ces compteurs dans le champ `skipped` du rapport. Gain mesuré : l'analyse d'un dépôt de 3 000 commits reste sous 2 minutes.
2. **La protection à l'envoi a failli disqualifier le dépôt** (voir § 4) : corrigé à la source par le steering et par le générateur de valeurs factices partagées dans `@placard/core`.
3. **La file Mergify exigeait l'application GitHub installée sur le dépôt**, geste réservé au navigateur : le dépôt a été câblé avec `.mergify.yml` validé (`mergify config simulate` → « 1 rule matches ») et un **merge auto-merge natif GitHub** en secours, afin que la chaîne « PR → CI verte → fusion automatique » ne dépende jamais d'un clic humain. Le même constat vaut pour le gate Hermes : le job `Hermes Lite (gate)` porte le label `hermes/conflit` et déclenche le workflow `hermes-conflict-resolver` dès qu'un vrai conflit est détecté.
4. **La saturation CPU du runner partagé** (le R630 héberge des dizaines de runners d'autres dépôts) a fait expirer un worker vitest sur un test pourtant vert : corrigé en bornant le parallélisme des tests (`maxForks: 4`) et en conservant le `node_modules` entre deux jobs (`clean: false` + `git clean` ciblé), ce qui a ramené l'installation de 1 à 2 minutes à quelques secondes.
5. **Les doublons de React** cassaient les tests d'interface (« A React Element from an older version of React »). Correction : `react` et `react-dom` déclarés à la racine, plus une copie d'entrée `packages/core/src/browser.ts` sans `node:crypto` pour le bundle web.
