/**
 * Source unique des raccourcis d'aide : un résumé court par section de l'application, avec un exemple et la
 * page du wiki qui détaille le sujet. Les pages du wiki (src/content/wiki) restent la référence complète :
 * ne rédigez jamais deux explications différentes du même sujet, ajoutez-les ici et dans le wiki à la fois.
 */

export interface HelpEntry {
  /** Titre court affiché dans le popover. */
  title: string;
  /** Deux ou trois phrases : à quoi sert la section, ce qu'il faut faire. */
  summary: string;
  /** Un exemple concret (Camille Martin, assistante commerciale). */
  example?: string;
  /** Identifiant de la page du wiki correspondante (`/aide/<page>`). */
  page: string;
}

export const HELP = {
  'mes-cv': {
    title: 'Mes CV',
    summary: 'Ici vous créez et retrouvez vos CV. Un CV se construit à partir de votre profil : vous n\'avez pas à tout ressaisir.',
    example: '« CV assistante commerciale – standard », créé en un clic.',
    page: 'creer-cv-standard',
  },
  profil: {
    title: 'Mon profil',
    summary: 'Votre profil rassemble toutes vos expériences, formations, compétences et langues. Chaque CV y puise ce qui lui convient.',
    example: 'Ajoutez un poste avec ses dates : il pourra figurer dans tous vos CV.',
    page: 'profil-remplir',
  },
  importer: {
    title: 'Importer mon CV',
    summary: 'Déposez votre CV (PDF ou Word) ou votre export LinkedIn : nous en extrayons les informations. Vous vérifiez la liste avant que rien ne soit enregistré.',
    example: 'Un CV en PDF déposé ici remplit vos coordonnées et vos expériences.',
    page: 'importer-cv',
  },
  editeur: {
    title: 'Éditeur de CV',
    summary: 'Choisissez les éléments de votre CV, leur ordre et leur présentation. L\'aperçu à droite montre le résultat final.',
    example: 'Décochez une formation ancienne pour gagner de la place sur la page.',
    page: 'creer-cv-standard',
  },
  modeles: {
    title: 'Modèles',
    summary: 'Le modèle donne l\'allure de votre CV. Vous pouvez le changer à tout moment, sans perdre votre contenu.',
    example: 'Classique pour un poste administratif, Élégant pour un profil expérimenté.',
    page: 'modeles',
  },
  dates: {
    title: 'Format des dates',
    summary: 'Choisissez la forme des périodes : « juin 2024 – auj. » laisse le plus de place sur la page.',
    example: 'Passez à « 06/2024 – auj. » si votre CV dépasse d\'un rien une page.',
    page: 'mise-en-page-dates',
  },
  'cv-standard': {
    title: 'CV standard',
    summary: 'Répondez à quelques questions simples : le poste visé, votre niveau, ce que vous voulez mettre en avant. Une IA rédige ensuite votre CV, sans rien inventer. Vous pouvez aussi le composer sans IA.',
    example: 'Poste visé : « Assistante commerciale » ; mettre en avant : « Relation client ».',
    page: 'creer-cv-standard',
  },
  'cv-offre': {
    title: 'Adapter à une offre',
    summary: 'Collez l\'annonce, faites-la analyser par une IA de votre choix, puis relisez ce qu\'elle propose. Rien n\'est appliqué sans votre accord. Sans IA, passez par le CV standard.',
    example: 'L\'annonce demande « gestion de portefeuille clients » : votre expérience le montre, vous le reprenez.',
    page: 'adapter-offre',
  },
  export: {
    title: 'Exporter',
    summary: 'Enregistrez votre CV en PDF pour l\'envoyer tel quel, ou en Word si l\'employeur demande un document modifiable.',
    example: '« Camille-Martin-CV.pdf », enregistré dans vos documents.',
    page: 'exporter',
  },
  candidatures: {
    title: 'Candidatures',
    summary: 'Suivez chaque candidature de la colonne « Brouillon » jusqu\'à « Terminé ». Notez les relances et les échanges.',
    example: 'Déplacez une carte dans « Entretien » dès que vous êtes convoqué.',
    page: 'candidatures',
  },
  parametres: {
    title: 'Paramètres',
    summary: 'Réglez l\'apparence, la rédaction du CV, vos sauvegardes et les options avancées. Choisissez une rubrique dans le sommaire.',
    example: 'Dans « Mes données », faites une sauvegarde chaque mois.',
    page: 'sauvegarder',
  },
  guide: {
    title: 'Guide de démarrage',
    summary: 'Le guide vous accompagne pas à pas, du premier import jusqu\'à votre premier CV. Vous pouvez le quitter à tout moment : votre avancement est gardé.',
    example: 'Cliquez sur « Quitter le guide » : vous le reprendrez où vous en étiez.',
    page: 'premiers-pas',
  },
  'guide-depart': {
    title: 'Point de départ',
    summary: 'Dites-nous d\'où vous partez : un CV existant, un export LinkedIn ou une page blanche. Le guide adapte la suite.',
    example: 'Un PDF de votre ancien CV suffit pour gagner du temps.',
    page: 'importer-cv',
  },
  'profil-identite': {
    title: 'Identité',
    summary: 'Votre nom, l\'intitulé que vous visez et vos coordonnées. Ces informations apparaissent en haut de vos CV.',
    example: 'Prénom et nom sont obligatoires ; le téléphone et l\'e-mail restent facultatifs.',
    page: 'profil-remplir',
  },
  'profil-experiences': {
    title: 'Expériences',
    summary: 'Chaque poste avec son intitulé, son entreprise et ses dates. Le début est obligatoire.',
    example: '« Assistante commerciale · Société Exemple · juin 2021 – juin 2024 ».',
    page: 'profil-experiences',
  },
  'profil-formations': {
    title: 'Formations',
    summary: 'Vos diplômes et formations, avec l\'année d\'obtention si vous la connaissez.',
    example: '« BTS Support à l\'action managériale · 2021 ».',
    page: 'profil-formations',
  },
  'profil-competences': {
    title: 'Compétences',
    summary: 'Les compétences que vous voulez mettre en avant. Chacune peut être renommée ou supprimée.',
    example: '« Gestion de la relation client », « Excel ».',
    page: 'profil-competences',
  },
  photo: {
    title: 'Photo',
    summary: 'La photo est facultative. Si vous en mettez une, choisissez-la sobre : fond clair, visage centré, photo récente.',
    example: 'Vous pouvez passer cette étape et ajouter une photo plus tard dans Mon profil.',
    page: 'profil-photo',
  },
  enrichir: {
    title: 'Enrichir son profil',
    summary: 'Ces informations sont facultatives, mais elles rendent votre CV plus convaincant : une accroche, vos missions, vos compétences, vos langues.',
    example: '« Suivi des commandes et de la facturation pour 40 clients. »',
    page: 'bien-rediger',
  },
  'enrichir-ia': {
    title: 'Enrichir avec une IA',
    summary: 'Une IA peut proposer des formulations à partir de votre profil. Vous relisez chaque proposition : rien n\'est ajouté sans votre accord.',
    example: 'Vous copiez un texte préparé dans l\'IA de votre choix, puis vous collez sa réponse.',
    page: 'utiliser-ia',
  },
  sauvegarde: {
    title: 'Sauvegarde',
    summary: 'Copiez vos données dans un fichier de sauvegarde (.cvmaker) que vous gardez en lieu sûr : clé USB, disque externe.',
    example: '« phenixcv_sauvegarde_2026-11-15.cvmaker » sur une clé USB.',
    page: 'sauvegarder',
  },
  'import-cvmaker': {
    title: 'Récupérer mes données CVmaker',
    summary: 'Dans CVmaker, téléchargez une sauvegarde (fichier .cvmaker), puis ouvrez-la ici. Vous voyez ce qui sera repris avant l\'import, et rien de ce que vous avez déjà n\'est remplacé sans votre accord.',
    example: '« resumeforge_backup_2026-11-15.cvmaker » : profil, expériences, CV et candidatures de Camille Martin.',
    page: 'recuperer-cvmaker',
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpId = keyof typeof HELP;

/** Page du wiki affichée par la touche F1, selon l'écran ouvert (chemin de l'adresse). */
export const SCREEN_WIKI_PAGE: Readonly<Record<string, string>> = {
  '/': 'premiers-pas',
  '/profile': 'profil-remplir',
  '/cv': 'creer-cv-standard',
  '/tracker': 'candidatures',
  '/import': 'importer-cv',
  '/settings': 'sauvegarder',
  '/aide': 'premiers-pas',
};

/** Page du wiki pour un chemin ; l'éditeur de CV (`/cv/<id>`) a la page dédiée au modèle et à la mise en page. */
export function wikiPageForPath(pathname: string): string {
  if (pathname.startsWith('/cv/')) return 'profil-remplir';
  if (pathname.startsWith('/aide/')) return pathname.slice('/aide/'.length).split('/')[0] || 'premiers-pas';
  return SCREEN_WIKI_PAGE[pathname] ?? 'premiers-pas';
}

/** Identifiants d'aide utilisés (ex. dans le code) qui n'ont pas d'entrée : vide = tout est couvert. */
export function missingHelpIds(used: readonly string[]): string[] {
  return [...new Set(used)].filter(id => !(id in HELP));
}
