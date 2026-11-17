import type { ImportFormat } from './types';

/** Extensions acceptées par l'import, avec le format correspondant. */
export const IMPORT_EXTENSIONS: Readonly<Record<string, ImportFormat>> = {
  pdf: 'pdf',
  docx: 'docx',
  zip: 'linkedin',
};

export type DroppedFile =
  | { ok: true; path: string; format: ImportFormat; name: string }
  | { ok: false; message: string };

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function extensionOf(path: string): string {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Choisit le fichier à importer parmi ceux déposés, avec un message clair si aucun ne convient. */
export function classifyDroppedPaths(paths: readonly string[]): DroppedFile {
  if (paths.length === 0) return { ok: false, message: "Aucun fichier n'a été reçu." };
  for (const path of paths) {
    const format = IMPORT_EXTENSIONS[extensionOf(path)];
    if (format) return { ok: true, path, format, name: fileName(path) };
  }
  const first = paths[0];
  const ext = extensionOf(first);
  if (ext === 'cvmaker') {
    return { ok: false, message: CVMAKER_DROPPED_MESSAGE };
  }
  if (ext === 'doc') {
    return { ok: false, message: `« ${fileName(first)} » est un ancien document Word (.doc). Ouvrez-le dans Word, puis enregistrez-le au format .docx avant de le déposer ici.` };
  }
  if (ext === 'odt' || ext === 'rtf' || ext === 'pages') {
    return { ok: false, message: `Le format .${ext} n'est pas pris en charge. Enregistrez votre CV en PDF ou en Word (.docx), puis déposez-le ici.` };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'].includes(ext)) {
    return { ok: false, message: "Une image ne peut pas être lue pour l'instant. Déposez plutôt votre CV au format PDF ou Word (.docx)." };
  }
  return { ok: false, message: `« ${fileName(first)} » n'est pas un fichier pris en charge. Déposez un CV en PDF ou en Word (.docx), ou un export LinkedIn (.zip).` };
}

/** Un fichier de sauvegarde déposé : il se récupère par son propre parcours. */
export const CVMAKER_DROPPED_MESSAGE =
  "C'est un fichier de sauvegarde (.cvmaker). Pour récupérer vos données CVmaker, choisissez « J'ai utilisé CVmaker » sur l'écran d'import. Pour restaurer une sauvegarde Phénix CV, ouvrez Paramètres › Mes données › Restauration.";

/** Message affiché quand un PDF ne contient aucun texte (document scanné). */
export const SCANNED_PDF_MESSAGE =
  "Ce PDF ne contient pas de texte lisible : c'est probablement une photo ou un scan. Utilisez un PDF créé depuis un traitement de texte, ou choisissez « Je préfère remplir moi-même ».";
