# @placard/ritual

Le **rituel de remédiation** de Placard : rotation → purge → prévention →
vérification, dans cet ordre imposé.

Le verrou d'ordre interdit la purge avant la rotation (un secret publié doit
être révoqué avant d'être effacé) et l'outil n'exécute jamais la réécriture
d'historique : il produit un script que vous lisez et lancez vous-même.

## Installation

```bash
npm install @placard/ritual
```

Le paquet installe `@placard/core` comme dépendance : une seule implémentation
du noyau, jamais une copie.

## Usage

```ts
import { createRitualApi } from '@placard/ritual';

const api = createRitualApi();
const etapes = api.steps(finding);           // rotation, purge, prévention, vérification
const carte = api.rotationCard(finding);      // fiche de rotation à transmettre
const purge = api.generatePurge(finding);     // script de purge (jamais exécuté ici)
const attestation = api.certificate(result);  // sceau de fin de rituel
```

## API publique (extraits)

| Export | Rôle |
|---|---|
| `createRitualApi` | construit l'API conforme au contrat `RitualApi` |
| `steps`, `markRotated` | étapes du rituel et verrou d'ordre |
| `rotationCard`, `rotationCards` | fiches de rotation (jamais la valeur brute) |
| `generatePurge`, `purgeScript` | script de réécriture d'historique (à lire avant de lancer) |
| `prevention` | règles de prévention (hook, garde-fou) |
| `verify` | vérification après remédiation |
| `certificate` | attestation canonique signée (HMAC-SHA-256) |
| `loadState`, `saveState` | état du rituel sur disque |

## Licence

MIT — voir [LICENSE](../../LICENSE).
