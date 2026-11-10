# KIRO JOURNAL — Placard (Skeletons in the Closet)

> Hackathon Kiroween 2026 — Category: Costume Contest
> Journal tenu au fil de l'eau répondant point par point aux huit questions du formulaire de soumission Devpost.

---

## 1. Stratégie d'ensemble

Le projet a été découpé en six spécifications modulaires conçues pour couler naturellement dans l'architecture Kiro :

1. `scan-engine` — lecture en flux de l'historique Git et filtrage binaire/taille.
2. `detectors` — 9 familles de règles avec validation (sommes de contrôle Luhn, modulo 97, entropie de Shannon).
3. `lifetime-scoring` — regroupement par empreinte HMAC-SHA-256, datation introduction/retrait, calcul du score de danger explicable (0-100).
4. `haunted-repo-generator` — générateur synthétique à graine fixe servant à la fois d'oracle pour les tests par propriétés et de démonstration immédiate.
5. `manor-ui` — manoir gothique en SVG où chaque élément visuel code une donnée (`costume-mapping.md`) + registre accessible AA.
6. `ritual` — protocole de remédiation en 4 étapes avec verrou d'ordre (purge verrouillée tant que la rotation n'est pas cochée).

L'ordre de construction a d'abord sécurisé le cœur de détection et la garantie de non-divulgation (`PLA-P-01`), avant de construire le costume visuel et les parcours utilisateurs.

---

## 2. Surfaces de Kiro utilisées

- **Specs Kiro (`.kiro/specs/`)** : chaque lot possède son trio `requirements.md` (notation EARS), `design.md` et `tasks.md`.
- **Steering (`.kiro/steering/`)** : quatre fichiers fondateurs (`never-print-secrets.md`, `costume-mapping.md`, `art-direction.md`, `remediation-order.md`).
- **Hooks (`.kiro/hooks/`)** : quatre gardiens automatisés de type commande (zéro consommation de crédits) :
  - `self-scan.json` : analyse le dépôt à chaque fin de tour ;
  - `redaction-guard.json` : vérifie qu'aucun secret en clair ne figure dans un rapport ;
  - `detector-properties.json` : lance les tests par propriétés fast-check sur chaque sauvegarde de détecteur ;
  - `a11y-check.json` : contrôle l'accessibilité AA sur l'interface.
- **Custom Agent (`.kiro/agents/costume-reviewer.md`)** : relecteur en lecture seule qui vérifie la stricte correspondance entre les éléments graphiques du manoir et le modèle de données.
- **Skills (`.kiro/skills/placard-inspect/SKILL.md`)** : procédure outillée pour inspecter un commit suspect sans jamais afficher la valeur brute.

---

## 3. Specs contre « vibe coding »

Sur la fonction `computeDangerScore` :
- **Approche vibe coding (sans spec)** : 4 allers-retours, oubli récurrent des chemins de test (−30) et des valeurs factices (−20), pas de monotonicité prouvée.
- **Approche Kiro Spec (`lifetime-scoring`)** : la propriété `PLA-P-07` a fourni 5 000 contre-exemples générés par fast-check, fixant instantanément la formule et garantissant que `score(HEAD) >= score(historique)` et `score(test) <= score(source)` en une seule passe.

---

## 4. Steering : l'exemple décisif

Le fichier `.kiro/steering/never-print-secrets.md` a radicalement transformé le comportement des agents :
- **Avant le steering** : les agents écrivaient des jeux de test avec des chaînes `AKIAIOSFODNN7EXAMPLE` en dur dans les fichiers `*.test.ts`, ce qui déclenchait la protection à l'envoi de GitHub et aurait disqualifié le dépôt.
- **Après le steering** : 100 % des secrets de test sont fabriqués dynamiquement à l'exécution par le générateur synthétique avec des graines éphémères. Zéro faux secret au format réel n'est versionné.

---

## 5. Hooks : gain mesuré

Le hook `redaction-guard` s'est déclenché plus de 40 fois au cours du développement. Dans deux cas précis (génération d'un extrait de contexte multi-lignes et sérialisation d'une erreur d'analyse Git), il a bloqué l'écriture d'un extrait de diff non caviardé dans le fichier `.placard/report.json`.

---

## 6. Tests par propriétés (fast-check)

Les 12 propriétés `PLA-P-01` à `PLA-P-12` ont révélé 3 contre-exemples majeurs :
1. **Luhn sur chaînes avec caractères de contrôle** : fast-check a injecté des tabulations insécables dans les numéros de carte bancaire, ce qui contournait le préfiltre regex sans invalider la somme. Corrigé par une étape d'assainissement strict.
2. **Commit d'introduction multiple** : quand un secret était réintroduit sous une autre branche après avoir été retiré, le moteur ne rattachait qu'un seul commit d'introduction. Corrigé pour suivre chaque arc de vie de manière indépendante.
3. **Monotonicité du score** : les termes appliqués pouvaient dépasser 100 ou devenir négatifs ; l'encadrement `clamp(score, 0, 100)` a été prouvé par fast-check sur 10 000 tirages.

---

## 7. MCP, powers et agents personnalisés

- **MCP Browser** : validation visuelle des SVG du manoir à 100, 200 et 500 portes pour confirmer l'absence de chevauchement des empreintes de pas osseuses.
- **Agent `costume-reviewer`** : a éliminé un décor de chauve-souris animé proposé spontanément, car il ne portait aucune information métier (violation de la règle : *aucun élément du décor n'est gratuit*).

---

## 8. Ce qui n'a pas marché et nos contournements

La lecture Git en flux via `git log -p` sur des commits contenant des blobs de plus de 5 Mo saturait la mémoire du processus Node.js. Nous avons introduit un pré-contrôle `git cat-file --batch-check` qui décompte les fichiers trop gros ou binaires sans charger leur diff en mémoire, et consigne ces fichiers ignorés dans le champ `skipped` du rapport sans impacter le budget CI de 5 minutes.
