# Skill : Inspection sécurisée d'un commit avec Placard

Cette compétence guide l'agent pour analyser un commit sans jamais exposer de valeur secrète brute dans le terminal ni dans un rapport.

## Étapes

1. Lancer l'analyse ciblée sur le commit :
   ```bash
   pnpm placard scan . --commit <hash>
   ```
2. Consulter la trouvaille par son identifiant unique et son empreinte HMAC :
   ```bash
   cat .placard/report.json | jq '.findings[] | select(.id == "sk_0001")'
   ```
3. Vérifier les métadonnées sans afficher la ligne brute :
   - Famille détectée
   - Règle déclenchée
   - Score de danger (0-100) et raisons associées
   - Aperçu masqué (`preview`)
   - Emplacement (`path`, `line`)
