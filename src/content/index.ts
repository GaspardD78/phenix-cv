/**
 * Contenu d'aide livré avec l'application : pages du wiki (Markdown dans `src/content/wiki`).
 * Chargées à la compilation : aucune requête réseau, fonctionnement hors ligne.
 */
import { loadWiki, type WikiLoadResult } from '@/lib/wiki';

const WIKI_FILES = import.meta.glob('./wiki/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const WIKI: WikiLoadResult = loadWiki(WIKI_FILES);

if (WIKI.errors.length > 0) {
  console.error('[aide] pages du wiki invalides :', WIKI.errors);
}
