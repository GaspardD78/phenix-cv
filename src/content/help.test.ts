import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HELP, SCREEN_WIKI_PAGE, missingHelpIds, wikiPageForPath } from './help';
import { brokenWikiLinks, loadWiki } from '../lib/wiki';

const SRC = join(import.meta.dir, '..');
const WIKI_DIR = join(import.meta.dir, 'wiki');

function wikiFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(WIKI_DIR).filter(f => f.endsWith('.md'))) out[`./wiki/${f}`] = readFileSync(join(WIKI_DIR, f), 'utf8');
  return out;
}

/** Tous les fichiers .tsx de src (hors tests). */
function sourceFiles(dir = SRC, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p);
  }
  return out;
}

/** Identifiants passés à `<HelpButton … />` (y compris dans une expression conditionnelle). */
function helpIdsIn(source: string): string[] {
  const tags = [...source.matchAll(/<HelpButton\b[^>]*>/g)].map(m => m[0]);
  // Valeurs de l'identifiant seulement : après `id=`, `?` ou `:` (pas les comparaisons `=== 'x'`).
  return tags.flatMap(tag => [...tag.matchAll(/(?:\?|:|id=\{?)\s*['"]([a-z][a-z-]*)['"]/g)].map(m => m[1]));
}

describe('une seule source : entrées, pages et ancres', () => {
  const { pages, errors } = loadWiki(wikiFiles());

  it('le wiki se charge sans erreur', () => {
    expect(errors).toEqual([]);
  });

  it('chaque entrée d\'aide renvoie vers une page du wiki existante', () => {
    const ids = new Set(pages.map(p => p.id));
    for (const [key, entry] of Object.entries(HELP)) {
      expect({ key, exists: ids.has(entry.page) }).toEqual({ key, exists: true });
    }
  });

  it('aucun lien cassé dans le wiki', () => {
    expect(brokenWikiLinks(pages)).toEqual([]);
  });

  it('supprimer une page casse le lien des aides qui la citent (le test échoue alors)', () => {
    const files = wikiFiles();
    delete files['./wiki/mise-en-page-dates.md'];
    const reduced = loadWiki(files).pages;
    const ids = new Set(reduced.map(p => p.id));
    expect(ids.has(HELP.dates.page)).toBe(false);
    expect(Object.values(HELP).some(e => !ids.has(e.page))).toBe(true);
  });

  it('la touche F1 n\'ouvre que des pages existantes', () => {
    const ids = new Set(pages.map(p => p.id));
    for (const [path, page] of Object.entries(SCREEN_WIKI_PAGE)) expect({ path, ok: ids.has(page) }).toEqual({ path, ok: true });
    expect(ids.has(wikiPageForPath('/cv/abc123'))).toBe(true);
    expect(wikiPageForPath('/inconnu')).toBe('premiers-pas');
    expect(wikiPageForPath('/aide/exporter')).toBe('exporter');
  });
});

describe('chaque icône « ? » a son entrée', () => {
  it('les identifiants des icônes présentes dans le code existent dans help.ts', () => {
    const used = sourceFiles().flatMap(f => helpIdsIn(readFileSync(f, 'utf8')));
    expect(used.length).toBeGreaterThan(5);
    expect(missingHelpIds(used)).toEqual([]);
  });

  it('une icône sans entrée est détectée', () => {
    expect(missingHelpIds(['profil', 'section-inconnue'])).toEqual(['section-inconnue']);
  });
});

describe('recherche plein texte dans le wiki', () => {
  it('retrouve une page connue : « formats de dates »', async () => {
    const { searchWiki } = await import('../lib/wiki');
    const { pages } = loadWiki(wikiFiles());
    expect(searchWiki(pages, 'formats de dates')[0]?.page.id).toBe('mise-en-page-dates');
  });
});
