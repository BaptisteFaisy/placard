# @placard/analysis

Le **moteur d'analyse** de Placard : regroupement des détections par
empreinte, durée de vie d'un secret, score de danger explicable, exclusions
(`.placard/ignore.yml`) et assemblage du rapport final.

Toutes les décisions sont déterministes : mêmes détections, même rapport.

## Installation

```bash
npm install @placard/analysis
```

Le paquet installe `@placard/core` comme dépendance : une seule implémentation
du noyau, jamais une copie.

## Usage

```ts
import { createAnalysisEngine } from '@placard/analysis';

const moteur = createAnalysisEngine();
const { report } = await moteur.analyze(
  { detections, repoMeta, headPresence },
  { salt: 'un-sel-stable', toolVersion: '0.1.0' },
);

console.log(report.findings.length, report.summary);
```

## API publique (extraits)

| Export | Rôle |
|---|---|
| `createAnalysisEngine`, `analyze` | analyse complète (détections → rapport) |
| `groupDetections`, `fingerprintOf` | regroupement par empreinte |
| `resolveLifetime`, `makePresence`, `lastSightingPerPath` | durée de vie d'un secret |
| `scoreGroup`, `daysBetween` | score de danger explicable (termes listés) |
| `loadIgnoreFile`, `appendIgnoreEntry`, `parseIgnoreText` | exclusions |
| `assembleReport`, `buildFindings`, `sanitizeContext` | rapport sans secret |

## Licence

MIT — voir [LICENSE](../../LICENSE).
