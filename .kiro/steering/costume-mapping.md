# Correspondance Costume ↔ Modèle de données (Costume Contest)

> Règle du concours : chaque élément effrayant DOIT coder une propriété d'une trouvaille.
> Aucun élément du décor n'est gratuit.

| Élément du manoir | Donnée représentée |
|---|---|
| Un étage | Une année d'historique (grenier = année la plus ancienne, rez-de-chaussée = année courante). |
| Le couloir, de gauche à droite | Le temps, dans l'ordre chronologique des commits de l'année. |
| Une porte | Un commit qui contient au moins une trouvaille. |
| Pan de mur étiqueté « N commits » | Une suite de commits sans aucune trouvaille, compressée. |
| Toiles d'araignée sur une porte | Âge du commit (plus de toiles = commit ancien). |
| Lueur sous la porte | Gravité maximale derrière la porte (rouge = critique, orange = élevée, jaune = moyenne, bleue = basse). |
| Type de squelette | Famille détectée : Squelette à clé (clé/jeton), Squelette à papiers (PII), Malle (fichier sensible), Os épars (chaîne suspecte). |
| Taille du squelette | Score de danger, gradué de 0 à 100. |
| Empreintes de pas osseuses | Durée de vie d'un même secret, reliant la porte d'introduction aux portes de retrait. |
| Squelette debout dans le hall | Secret encore présent dans la version courante (`HEAD`). |
| Fenêtre ouverte dans le couloir | Le dépôt a un dépôt distant public (exposition réelle). |
| Sceau de cire rouge sur la porte | Trouvaille traitée (rotation effectuée et purge validée). |
| Ruban noué sur la porte | Faux positif écarté avec raison motivée (`.placard/ignore.yml`). |
| La lanterne | Le focus : suit le curseur ou la navigation clavier et éclaire la trouvaille active. |
| Le registre sur le guéridon | Vue en tableau accessible (AA), contenant exactement les mêmes données. |
