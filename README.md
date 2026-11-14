# Phénix CV

Phénix CV est une application de bureau (Windows) qui vous guide pas à pas : votre profil, un CV clair et soigné, puis l'export en PDF ou en Word. **Vos données restent sur votre ordinateur.**

> Version en cours de construction : l'assistant de démarrage, l'aide intégrée et le wiki arrivent dans les prochaines étapes.

## Ce que fait l'application

- **Mon profil** : toutes vos expériences, formations, compétences, langues… Le profil est un réservoir, chaque CV y puise.
- **Mes CV** : plusieurs modèles, aperçu en direct, ajustement à une page.
- **Export** : PDF ou Word.
- **Candidatures** : un tableau de suivi (facultatif).
- **Sauvegarde** : fichier `.cvmaker` enregistré où vous voulez ; synchronisation Google Drive facultative.
- **IA facultative** : l'application prépare un texte à copier dans ChatGPT ou Claude, puis relit la réponse. Aucune suggestion n'entre dans votre profil sans votre validation. Tout fonctionne aussi sans IA.

## Développement

Prérequis : [Bun](https://bun.sh), [Rust](https://rustup.rs) et les [prérequis Tauri 2](https://tauri.app/start/prerequisites/).

```bash
bun install
bun run tauri dev      # lancer l'application
bunx tsc --noEmit      # typage strict
bun test               # tests
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
bun run tauri build    # installateur Windows (sur une machine Windows)
```

Le workflow `.github/workflows/ci.yml` vérifie le code et construit l'installateur Windows ; l'installateur est conservé quelques jours en tant qu'artefact, sans publication de Release.

### Synchronisation Google Drive (facultative)

Aucun identifiant n'est fourni avec le code. Pour l'activer, créez un client OAuth « Application de bureau » dans la console Google Cloud (API Drive activée), puis copiez `.env.example` en `.env` et renseignez `VITE_GDRIVE_CLIENT_ID` (et, si besoin, `VITE_GDRIVE_CLIENT_SECRET`). Sans cela, la synchronisation est désactivée et la sauvegarde locale reste disponible.

## Licence

Copyright (C) 2026 Gaspard Douté.

Phénix CV est un logiciel libre : vous pouvez le redistribuer et le modifier selon les termes de la licence publique générale GNU, version 3. Il est distribué sans aucune garantie. Voir le fichier [LICENSE](LICENSE).
