# Architecture

## Vue d'ensemble

- **Frontend** : React 19, Vite, Tailwind 4, Zustand. Routes : `/` (accueil), `/profile`, `/cv`, `/cv/:id`, `/tracker`, `/import`, `/settings`, `/aide`, `/print` (rendu d'impression).
- **Backend Tauri** (`src-tauri/src/lib.rs`) : `get_db_uri` (base locale, mode portable si un fichier `.portable` est à côté de l'exécutable), `generate_pdf` (rendu PDF vectoriel), `start_oauth_server` (retour OAuth local pour Google Drive).
- **Base** : SQLite, un schéma initial (`001_init.sql`). Réglages par profil dans la table `settings` (clés `nom:{profileId}`, voir `src/lib/profile-settings.ts`).

## Données

`profiles` → `master_entries` (le réservoir : expériences, formations, compétences…) → `cv_documents` + `cv_blocks` (un CV choisit et ordonne des entrées). `applications`, `application_events`, `application_attachments`, `compatibility_scores` pour le suivi des candidatures.

## Moteur de CV

1. `lib/cv-prompt.ts` compose le texte à copier dans une IA (règles dans `cv-focus-rules.ts`, ciblage dans `cv-targets.ts` et `cv-target-prompt.ts`, mises en avant dans `cv-angles.ts`).
2. `lib/ai-cv-response.ts` lit la réponse (tolérante), `lib/ai-cv-guard.ts` et `lib/cv-target-guard.ts` vérifient (aucune invention).
3. `lib/apply-ai-cv.ts` applique le résultat aux blocs du CV, de façon idempotente et réversible.
4. `components/export/PrintableCV.tsx` rend le CV ; `lib/export-pdf.ts` et `lib/export-docx.ts` exportent.

## Import

`lib/import/*` : PDF, Word, export LinkedIn, ou réponse d'une IA. Le rapprochement avec le profil existant est dans `lib/experience-matching.ts` et `lib/duplicate-scan.ts`.

## Score de compatibilité

`lib/compatibility-scorer.ts`, avec un dictionnaire de synonymes généraliste (`lib/synonyms.ts`).

## Synchronisation Drive

`lib/gdrive.ts` (OAuth PKCE) et `lib/gdrive-config.ts` : les identifiants viennent du build (`.env`) ou d'une saisie dans les options avancées ; sans identifiants, la synchronisation est désactivée.
