# Fichiers d'exemple CVmaker

Sauvegardes `.cvmaker` produites par le **vrai code de sauvegarde de CVmaker** (`resume-forge/src/lib/backup.ts`), pour tester l'import dans Phénix CV. Données entièrement fictives : Camille Martin, entreprises fictives, faux jetons (`FAUX-…`).

| Fichier | Contenu |
|---|---|
| `camille-martin-recent.cvmaker` | Version actuelle de CVmaker : photo, permis, mentions d'en-tête, liens GitHub et site, une date « 09/2015 », un CV avec une ancienne ligne de compétences, une candidature avec pièce jointe, faux jetons Google Drive, veille emploi avec faux secrets. |
| `camille-martin-2026-05.cvmaker` | Version de CVmaker du 8 mai 2026 (commit `9e28c88`) : sans photo, permis, mentions d'en-tête ni angles de CV. |
| `camille-martin-abime.cvmaker` | Le fichier récent coupé en deux (téléchargement interrompu). |

`SOURCE.txt` indique les versions de CVmaker utilisées.

## Régénérer

Avec un clone de `GaspardD78/CVmaker` (lecture seule : rien n'y est écrit ; l'historique doit contenir `9e28c88`) :

```bash
CVMAKER_DIR=/chemin/vers/CVmaker bun test ./tests/fixtures/cvmaker/generate.ts
```

`generate.ts` ne s'appelle pas `*.test.ts` : il ne tourne ni avec `bun test` ni en CI.
