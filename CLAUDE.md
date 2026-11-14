# Phénix CV : consignes de développement

Application de bureau Tauri 2 (Rust) + React 19 + TypeScript strict + SQLite (`tauri-plugin-sql`) + Zustand 5 + Tailwind 4. Gestionnaire de paquets unique : Bun.

## Commandes

- `bun install`
- `bunx tsc --noEmit` : typage strict (doit rester sans erreur)
- `bun test` : tests
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`

## Règles

- Toute l'interface est en français, avec le vouvoiement et un ton simple et chaleureux. Pas de jargon : « IA » (pas « LLM »), « fichier de sauvegarde » (pas « JSON »), « Mon profil » partout.
- Aucune donnée personnelle dans le dépôt : exemples, fixtures et tests utilisent la personne fictive Camille Martin, assistante commerciale. Les prompts envoyés à l'IA restent neutres et multi-métiers.
- Aucune suggestion (IA ou automatique) n'entre dans le profil ou le CV sans validation explicite.
- Tout parcours doit fonctionner sans IA ; l'IA est une amélioration facultative.
- Aucun identifiant OAuth dans le code (voir `.env.example`).
- Un seul profil local ; la colonne `profile_id` reste dans les tables.
- Schéma SQL : `src-tauri/migrations/001_init.sql`. Les évolutions futures s'ajoutent en nouvelles migrations.

## Structure

`src/components` (écrans), `src/stores` (Zustand), `src/lib` (logique pure : moteur de CV, prompts, garde-fou, exports), `src/templates` (modèles de CV), `src-tauri` (Rust : base, export PDF, serveur OAuth local). Voir `ARCHITECTURE.md`.
