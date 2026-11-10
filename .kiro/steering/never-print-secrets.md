# Steering Kiro — Règle absolue de non-divulgation des secrets

> Identifiants associés : PLA-N-02, PLA-N-09, propriété PLA-P-01.
> Ce fichier est injecté en permanence dans le contexte de tous les agents Kiro.

## Règles fondamentales

1. **Zéro secret dans le dépôt** :
   - Aucun faux secret au format réel (`AKIA...`, `ghp_...`, `AIza...`, clé privée PEM) ne doit JAMAIS être écrit en dur dans un fichier source, un test, une fixture ou une documentation.
   - Tous les jeux de test fabriquent leurs valeurs factices **dynamiquement à l'exécution** (mémoire vive uniquement).

2. **Caviardage immédiat** :
   - Toute valeur détectée est immédiatement convertie en son empreinte HMAC-SHA-256 (avec sel propre au dépôt) et son aperçu masqué (`AKIA...(20)`).
   - Les extraits de contexte (`contextLines`) remplacent systématiquement la valeur détectée par `[REDACTED:<family>]` avant de quitter le moteur d'analyse.

3. **Sorties propres** :
   - Les rapports JSON, les journaux de console, la sortie standard et les traces d'erreur ne contiennent JAMAIS la valeur brute.
   - Le script de purge (`placard ritual`) écrit le fichier de remplacement des secrets dans un dossier temporaire du système hors du dépôt (`/tmp/placard-...`), avec des droits `0600`, et le détruit dès confirmation.
