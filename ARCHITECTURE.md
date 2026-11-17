# Architecture

## Vue d'ensemble

- **Frontend** : React 19, Vite, Tailwind 4, Zustand. Routes : `/` (accueil), `/profile`, `/cv`, `/cv/:id`, `/tracker`, `/import`, `/settings`, `/aide`, `/print` (rendu d'impression).
- **Backend Tauri** (`src-tauri/src/lib.rs`) : `get_db_uri` (base locale), `get_app_mode` et `write_auto_backup` (où sont les données, sauvegarde automatique avant restauration ou import), le mode portable (`src-tauri/src/portable.rs` : si un fichier `.portable` est à côté de l'exécutable, base, sauvegardes, journal PDF et données de WebView2 vont dans `data/`), `generate_pdf` (export PDF vectoriel, voir ci-dessous), `start_oauth_server` (retour OAuth local pour Google Drive).
- **Base** : SQLite, un schéma initial (`001_init.sql`). Réglages par profil dans la table `settings` (clés `nom:{profileId}`, voir `src/lib/profile-settings.ts`).

## Données

`profiles` → `master_entries` (le réservoir : expériences, formations, compétences…) → `cv_documents` + `cv_blocks` (un CV choisit et ordonne des entrées). `applications`, `application_events`, `application_attachments`, `compatibility_scores` pour le suivi des candidatures.

## Moteur de CV

1. `lib/cv-prompt.ts` compose le texte à copier dans une IA (règles dans `cv-focus-rules.ts`, ciblage dans `cv-targets.ts` et `cv-target-prompt.ts`, mises en avant dans `cv-angles.ts`).
2. `lib/ai-cv-response.ts` lit la réponse (tolérante), `lib/ai-cv-guard.ts` et `lib/cv-target-guard.ts` vérifient (aucune invention).
3. `lib/apply-ai-cv.ts` applique le résultat aux blocs du CV, de façon idempotente et réversible.
4. `components/export/PrintableCV.tsx` rend le CV ; `lib/export-pdf.ts` et `lib/export-docx.ts` exportent.

## Modèles de CV

`src/templates/` : un fichier par modèle, enregistré dans `src/templates/index.ts` (`templates` et `TEMPLATE_ORDER`, l'ordre du sélecteur). Le même composant `PrintableCV` rend l'aperçu et le PDF ; `lib/export-docx.ts` produit le Word avec le même contenu. Polices autorisées : voir `src/theme/fonts.test.ts`. Chaque modèle a sa vignette dans `TemplatePickerPopover.tsx` et ses références dans `tests/golden/references/`.

Organisation d'un modèle (tout est facultatif ; sans réglage, le rendu d'origine) :

- `layout` : `linear` (une colonne), `sidebar-left` / `sidebar-right` (bande latérale colorée), `header-columns` (en-tête pleine largeur, puis une colonne sans fond pour les sections « badges », séparée par un filet), `two-equal` (en-tête pleine largeur, puis deux colonnes égales : expériences, projets et bénévolat à gauche, le reste à droite), `magazine` (colonne large et encadré clair à droite pour l'accroche et les sections « badges »).
- `structure.header` : `centered`, `left`, `split` (coordonnées empilées à droite), `monogram` (initiales en décor, remplacées par la photo) ou `hero` (bloc clair pleine largeur, photo à cheval sur son bord).
- `structure.entry` : `stacked`, `date-gutter` (dates dans une marge à gauche), `timeline` (frise verticale), `inline` (« Intitulé, Entreprise » sur une ligne), `date-below` (dates sur la ligne de l'entreprise), `hanging` (intitulé en saillie, le reste en retrait), `card` (entrée dans un cadre), `date-above` (dates au-dessus de l'intitulé), `pill` (dates en pastille) ou `alternate` (frise centrale, contenu alterné).
- `structure.section` : `stacked` ou `margin` (titre dans une colonne étroite à gauche).
- `structure.heading` : `label` (étiquette claire ajustée au titre), `band` (bande claire pleine largeur), `highlight` (aplat clair sous le titre et le nom) ou `rule-after` (filet qui prolonge le titre) ; `structure.headerRule: false` retire le trait sous l'en-tête ; `structure.badges: 'tiles'` regroupe les sections « badges » en tuiles en fin de CV.
- `docx.headingRule` (`bottom`, `left`, `none`, `label`, `band`), `docx.headingUppercase`, `docx.headingItalic` et `docx.nameHighlight` : titres de section et nom dans Word.

Un modèle compatible ATS reste en une colonne (`category: 'ats'`), sans tableau ni zone de texte dans Word ; un modèle à deux colonnes porte `atsOptimized: false` (badge « Non-ATS » dans le sélecteur). Une seule couleur d'accent (palette ou réglage du CV), sans dégradé ni fond sombre.

| Modèle | id | Colonnes | Organisation |
|---|---|---|---|
| Classique | `ats-classic` | 1 (ATS) | en-tête centré, titres soulignés |
| Moderne | `ats-modern` | 1 (ATS) | titres affirmés, bandeau possible |
| Chronologique | `ats-chrono` | 1 (ATS) | en-tête à gauche, dates en marge |
| En-tête scindé | `ats-scinde` | 1 (ATS) | coordonnées à droite, repère vertical des titres |
| Frise | `ats-frise` | 1 (ATS) | frise verticale, titres en serif sans capitales |
| Étiquettes | `ats-etiquettes` | 1 (ATS) | titres en étiquette, intitulé et entreprise sur une ligne |
| Bandes claires | `ats-bandes` | 1 (ATS) | titres sur une bande claire, dates sous l'intitulé |
| Lettre | `ats-lettre` | 1 (ATS) | aucun trait, titres en italique, entrées en retrait |
| Minimaliste | `minimalist` | 1 (ATS) | titres gris sans trait |
| Élégant | `elegant` | 1 | filet sur le bord gauche de la page |
| Executive | `executive` | 1 | titres centrés entre deux traits |
| Compact | `tech` | 1 | dense, titres à marqueur |
| Créatif | `creative` | 1 | grand nom, bandeau possible |
| Monogramme | `monogramme` | 1 (non-ATS) | initiales en monogramme, titres en italique prolongés d'un filet |
| Surligneur | `surligneur` | 1 (non-ATS) | aplat clair sous le nom et les titres, dates en pastille |
| Grand en-tête | `grand-entete` | 1 (non-ATS) | bloc clair pleine largeur, photo à cheval, compétences en tuiles |
| Académique | `academic` | 1 | dense, compétences en liste à virgules |
| Sidebar Moderne | `sidebar-modern` | 2 (non-ATS) | bande sombre à gauche |
| Deux colonnes colorées | `sidebar-tech` | 2 (non-ATS) | bande colorée à gauche |
| Sidebar Élégant | `sidebar-elegant` | 2 (non-ATS) | bande claire à droite |
| Titres en marge | `marge` | 2 (non-ATS) | titres dans la marge, contenu à droite |
| Deux colonnes à filet | `colonnes-filet` | 2 (non-ATS) | en-tête pleine largeur, colonne sans fond et filet |
| Deux colonnes égales | `grille` | 2 (non-ATS) | parcours à gauche, le reste à droite, à parts égales |
| Cartes | `cartes` | 1 (non-ATS) | chaque entrée dans un cadre à liseré |
| Magazine | `magazine` | 2 (non-ATS) | grand nom, colonne large et encadré clair à droite |
| Frise centrale | `frise-centrale` | 2 (non-ATS) | ligne au centre, parcours alterné de part et d'autre |

Tests : `PrintableCV.test.tsx` (nombre de modèles, sections), `src/templates/structures.test.tsx` (organisations, Word), `bun run test:golden` (rendu PDF, hors CI).

## Import

`lib/import/*` : PDF, Word, export LinkedIn, ou réponse d'une IA. Le rapprochement avec le profil existant est dans `lib/experience-matching.ts` et `lib/duplicate-scan.ts`.

## Score de compatibilité

`lib/compatibility-scorer.ts`, avec un dictionnaire de synonymes généraliste (`lib/synonyms.ts`).

## Synchronisation Drive

`lib/gdrive.ts` (OAuth PKCE) et `lib/gdrive-config.ts` : les identifiants viennent du build (`.env`) ou d'une saisie dans les options avancées ; sans identifiants, la synchronisation est désactivée.

## Export PDF

`src-tauri/src/pdf/` : échelle de repli **WebView2 (`ICoreWebView2_7::PrintToPdf`, fenêtre cachée) → Edge → Chrome** ; l'impression système est le dernier recours, côté interface. Chaque étape a un délai maximal de 20 s, la fenêtre cachée est toujours détruite, et la dernière tentative est journalisée (`pdf-export-last.json`, dossier de données). La méthode se règle dans Paramètres > Options avancées, ou avec la variable `PHENIXCV_PDF_METHOD` (`auto`, `webview2`, `edge`, `chrome`). L'interface d'impression WebView2 est détectée à l'exécution (`cast`), jamais par numéro de version.

Auto-test (CI) : avec `PHENIXCV_SELFTEST_HTML` et `PHENIXCV_SELFTEST_PDF`, l'application génère le PDF puis quitte (code 0 ou 1) ; `scripts/selftest-pdf.ps1` et `scripts/check-pdf.py` vérifient une page A4, le texte et les polices embarquées.
