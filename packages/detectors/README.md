# @placard/detectors

Les **règles de détection** de Placard : neuf familles (clouds, jetons, clés
privées, mots de passe, IBAN, cartes, NIR, données personnelles, fichiers
risqués), un préfiltre par mots-clés et les validations arithmétiques
(Luhn, mod-97, entropie).

Garanties du paquet :

- aucune valeur détectée ne sort du moteur autrement que dans
  `RawDetection.value`, à destination de l'empreinte HMAC ;
- aucune exception sur un contenu hostile ;
- les valeurs de test sont **fabricées**, jamais des secrets réels.

## Installation

```bash
npm install @placard/detectors
```

Le paquet installe `@placard/core` comme dépendance : une seule implémentation
du noyau, jamais une copie.

## Usage

```ts
import { createDetectorEngine, builtinRules } from '@placard/detectors';

const moteur = createDetectorEngine({ rules: builtinRules() });
const resultat = moteur.scan({ path: 'config/env.ts', content: '...' });

for (const detection of resultat.detections) {
  console.log(detection.ruleId, detection.family, detection.severity);
}
```

## API publique (extraits)

| Export | Rôle |
|---|---|
| `createDetectorEngine` | construit un moteur conforme au contrat `DetectorEngine` |
| `builtinRules`, `builtinRuleSet`, `RULE_IDS` | jeu de règles par défaut |
| `scanFile` | scanne un fichier (taille, binaire, dépassements) |
| `makePrefilter`, `prefilterMatches`, `compileKeywords` | préfiltre par mots-clés |
| `resolveOverlaps`, `compareDetections` | arbitrage des détections qui se chevauchent |
| `entropyAtLeast`, `isPlausibleSecret`, `luhnValid`, `mod97Valid` | validateurs |
| `loadCustomRules`, `parseCustomRules` | règles personnalisées (YAML/JSON) |

## Licence

MIT — voir [LICENSE](../../LICENSE).
