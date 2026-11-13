# Ordre strict du rituel de remédiation

> Règle de sécurité : un secret qui a fuité dans Git doit d'abord être révoqué chez son fournisseur.
> La purge de l'historique sans rotation laisse une clé active dans la nature.

## Les 4 étapes

1. **Étape 1 — Rotation** :
   - Révoquer le jeton ou renouveler la clé chez le fournisseur.
   - Vérifier la date du dernier usage.
   - Fiche d'assistance fournie pour les principaux fournisseurs.
   - L'utilisateur doit attester de la rotation (ou justifier l'absence d'objet).

2. **Étape 2 — Purge** :
   - Retirer la valeur de l'historique complet via `git-filter-repo`.
   - **VERROUILLÉE** tant que l'étape 1 n'est pas validée.
   - L'outil ne touche jamais le dépôt en place : il génère un script et un fichier de remplacements sécurisé à exécuter sur un clone miroir.

3. **Étape 3 — Prévention** :
   - Mise à jour du `.gitignore` pour bloquer les fichiers sensibles.
   - Installation du crochet pre-commit (`placard scan --staged`).
   - Recommandation d'activer la protection GitHub push protection.

4. **Étape 4 — Vérification** :
   - Nouvelle passe d'analyse.
   - Si la valeur a disparu, la porte reçoit son sceau de cire et le certificat `PLACARD.md` est émis.
