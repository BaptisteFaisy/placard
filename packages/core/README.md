# @placard/core

Le noyau partagé du moteur **Placard** : contrats TypeScript, schéma Zod du
rapport, empreintes HMAC des valeurs détectées, score de danger explicable et
fabrique de valeurs de test.

Ce paquet ne dépend que de `zod` : il ne touche jamais au réseau et ne lit
jamais un dépôt Git. Tout ce qui est « système de fichiers » vit dans les
paquets specialised (`@placard/git-history`, `@placard/ritual`).

## Installation

```bash
npm install @placard/core
```

Node.js ≥ 20.11. Le paquet est publié en **ESM** (`import`), avec les types
TypeScript embarqués (`types` + `exports`).

## Usage

```ts
import { FAMILIES, shannonEntropy, fakeEmail } from '@placard/core';

// Les familles de détection reconnues par le moteur.
console.log(FAMILIES.length);

// L'empreinte d'une valeur : HMAC-SHA-256, jamais la valeur brute.
console.log(shannonEntropy('un-mot-de-passe-courant'));
```

## API publique (extraits)

| Export | Rôle |
|---|---|
| `FAMILIES`, `FAMILY_TO_SKELETON` | familles de détection et leur costume |
| `shannonEntropy`, `isDummyValue` | mesure de l'entropie, détection de valeurs factices |
| `luhnValid`, `mod97Valid`, `nirValid` | validations de clé bancaire, IBAN, NIR |
| `fakeValue`, `fakeEmail`, `fakeIban`, `fakeCardNumber` | fabrique de valeurs de test (aucun secret réel) |
| `SEVERITY_ORDER`, `SEVERITY_THRESHOLDS` | ordre et seuils de sévérité |
| `REPORT_SCHEMA_VERSION`, `TOOL_VERSION` | versions du rapport et de l'outil |

Les contrats (`DetectorEngine`, `AnalysisApi`, `RitualApi`, `AnalysisResult`,
`AnchoredDetection`…) sont exportés en types : ce sont eux qui font la loi
entre les paquets.

## Licence

MIT — voir [LICENSE](../../LICENSE).
