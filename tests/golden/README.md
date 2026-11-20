# Golden tests du rendu PDF

Filet de sécurité avant toute modification du rendu des CV. Le banc régénère les PDF de chaque modèle à partir de jeux de données fictifs (personne fictive : Camille Martin, assistante commerciale), puis les compare à des références versionnées : texte extrait du PDF, image de chaque page, empreinte du HTML d'export, dépassement de page.

## Commandes

```bash
bun run test:golden                  # compare aux références (code ≠ 0 si écart)
bun run test:golden -- --update      # régénère toutes les références
bun run test:golden -- --only elegant
```

Ce banc est séparé de `bun test` et n'est pas exécuté par la CI. Il demande Chromium et des polices système (Liberation, Carlito, Caladea) ; avec un autre Chromium que celui des références, pointez-le avec `GOLDEN_CHROMIUM=/chemin/vers/chrome`.

Fixtures : `fixtures/` (`une-page`, `deux-pages`, `titres-longs`, `minimal`). Sorties : `tests/golden/.out/` (ignoré par git).

Export multipage : un CV qui dépasse la première page est imprimé sur plusieurs pages. Le banc vérifie alors qu'aucune ligne mesurée ne manque dans le PDF, et qu'un CV annoncé « tient » donne bien un PDF d'une seule page (fixture `deux-pages` : 2 pages pour la plupart des modèles).
