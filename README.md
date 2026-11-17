# Phénix CV

Phénix CV est une application de bureau pour Windows qui vous guide pas à pas : votre profil, un CV clair et soigné, puis l'export en PDF ou en Word. **Vos données restent sur votre ordinateur.**

Version 0.1, en développement actif.

## Ce que fait l'application

- **Guide de démarrage** : au premier lancement, il vous accompagne de l'import de votre CV (ou d'une page blanche) jusqu'à l'export de votre premier CV.
- **Mon profil** : expériences, formations, compétences, langues, certifications, projets, bénévolat, centres d'intérêt, photo, permis et mentions d'en-tête. Le profil est un réservoir : chaque CV y puise, sans le modifier.
- **Importer** : un CV existant en PDF ou en Word, ou votre profil LinkedIn (archive téléchargée depuis LinkedIn). Rien n'est enregistré avant votre validation. Vous avez utilisé **CVmaker** ? Récupérez vos données depuis Paramètres › Mes données › Restauration, avec votre fichier `.cvmaker` : vous voyez ce qui sera repris, et rien n'est remplacé sans votre accord.
- **Mes CV** :
  - **CV standard** : vous répondez à quelques questions (poste visé, ce que vous voulez montrer…), puis une IA rédige votre CV avec les mots de votre métier. Vous pouvez aussi le composer sans IA.
  - **Adapter à une offre** : vous collez une annonce, une IA adapte votre CV à cette offre. Un contrôle signale tout ce qui n'est pas prouvé par votre profil, et vous pouvez répondre à ses remarques.
  - 26 modèles (sobres, adaptés aux logiciels de tri des recruteurs, ou graphiques), aperçu en direct, ajustement à une page, CV en français ou en anglais.
- **Export** : PDF ou Word, avec un nom de fichier proposé.
- **Candidatures** : un tableau de suivi par étapes, avec l'historique et les pièces jointes de chaque candidature, et un export en archive ZIP. Vous pouvez y importer votre suivi tenu dans Excel, Google Sheets ou LibreOffice, avec une IA ou en associant vous-même les colonnes : vous vérifiez un aperçu avant l'import, et vous pouvez l'annuler en un clic juste après.
- **Sauvegarde** : un fichier de sauvegarde (`.cvmaker`) enregistré où vous voulez, et une synchronisation Google Drive facultative. Avant chaque restauration, une copie de vos données actuelles est faite automatiquement. Une sauvegarde ne contient jamais vos identifiants (Google Drive…).
- **Aide** : une bulle « ? » sur chaque écran, un guide intégré, et la touche **F1** pour ouvrir l'aide de l'écran en cours.

## L'IA dans Phénix CV

Pour rédiger ou adapter un CV, l'IA est proposée en premier. L'application prépare un texte : vous le copiez dans l'IA de votre choix (ChatGPT, Claude, Gemini…), puis vous recollez sa réponse. L'application elle-même n'envoie rien sur internet.

- La réponse de l'IA est contrôlée avant d'être appliquée : un chiffre, une compétence ou une expérience que votre profil ne prouve pas est signalé, jamais ajouté en silence.
- Aucune suggestion n'entre dans votre profil ou votre CV sans votre validation.
- Chaque parcours propose aussi une solution sans IA.

## Vos données

Tout est enregistré dans une base locale, dans le dossier de données de l'application.

**Mode portable** : si un fichier nommé `.portable` se trouve à côté de l'application, les données sont enregistrées dans un dossier `data` à côté d'elle, par exemple sur une clé USB.

## Développement

Prérequis : [Bun](https://bun.sh), [Rust](https://rustup.rs) et les [prérequis Tauri 2](https://tauri.app/start/prerequisites/). L'architecture est décrite dans [ARCHITECTURE.md](ARCHITECTURE.md), les règles de contribution dans [CLAUDE.md](CLAUDE.md).

```bash
bun install
bun run tauri dev      # lancer l'application
bunx tsc --noEmit      # typage strict
bun test               # tests
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
bun run tauri build    # installateurs Windows .exe et .msi (sur une machine Windows)
```

**Rendu des CV** : `bun run test:golden` compare le PDF de chaque modèle à des références. Il demande Chromium et quelques polices, et ne tourne pas en CI : voir [tests/golden/README.md](tests/golden/README.md).

**Données de test** : exemples, fichiers d'essai et tests utilisent uniquement une personne fictive, Camille Martin, et des entreprises fictives.

**Intégration continue** : le workflow `.github/workflows/ci.yml` vérifie le typage, lance les tests TypeScript et Rust, clippy, construit l'application Windows et teste l'export PDF (WebView2, mode automatique, Edge, Chrome). L'installateur et les PDF d'essai sont conservés trois jours en tant qu'artefacts, sans publication de Release.

### Synchronisation Google Drive (facultative)

Aucun identifiant n'est fourni avec le code. Pour l'activer, créez un client OAuth « Application de bureau » dans la console Google Cloud (API Drive activée), puis copiez `.env.example` en `.env` et renseignez `VITE_GDRIVE_CLIENT_ID` (et, si besoin, `VITE_GDRIVE_CLIENT_SECRET`). Sans cela, la synchronisation est désactivée et la sauvegarde locale reste disponible.

## Licence

Copyright (C) 2026 Gaspard Douté.

Phénix CV est un logiciel libre : vous pouvez le redistribuer et le modifier selon les termes de la licence publique générale GNU, version 3. Il est distribué sans aucune garantie. Voir le fichier [LICENSE](LICENSE).
