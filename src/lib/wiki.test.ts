import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokenWikiLinks, findWikiPage, internalLinks, loadWiki, normalizeSearch, parseFrontmatter, searchWiki, wikiGroups } from './wiki';

const WIKI_DIR = join(import.meta.dir, '..', 'content', 'wiki');

function wikiFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of readdirSync(WIKI_DIR).filter(f => f.endsWith('.md'))) out[`./wiki/${f}`] = readFileSync(join(WIKI_DIR, f), 'utf8');
  return out;
}

describe('métadonnées des pages', () => {
  it('lit l\'en-tête et sépare le corps', () => {
    const { meta, body } = parseFrontmatter('---\nid: test\ntitle: Un titre\ngroup: Aide\n---\n\nTexte');
    expect(meta).toEqual({ id: 'test', title: 'Un titre', group: 'Aide' });
    expect(body).toBe('\nTexte');
  });
  it('sans en-tête : pas de métadonnées, texte entier', () => {
    expect(parseFrontmatter('Bonjour').meta).toEqual({});
  });
});

describe('chargement du wiki', () => {
  it('toutes les pages du dépôt se chargent sans erreur, identifiants uniques', () => {
    const { pages, errors } = loadWiki(wikiFiles());
    expect(errors).toEqual([]);
    expect(pages.length).toBe(19);
    expect(new Set(pages.map(p => p.id)).size).toBe(pages.length);
  });
  it('identifiant invalide, doublon ou titre manquant : signalé', () => {
    const { pages, errors } = loadWiki({
      'a.md': '---\nid: Mauvais Id\ntitle: X\ngroup: Aide\n---\nx',
      'b.md': '---\nid: ok\ntitle: Bon\ngroup: Aide\n---\nx',
      'c.md': '---\nid: ok\ntitle: Doublon\ngroup: Aide\n---\nx',
      'd.md': '---\nid: sans-titre\ngroup: Aide\n---\nx',
    });
    expect(pages.map(p => p.id)).toEqual(['ok', 'sans-titre']);
    expect(errors.join(' ')).toContain('invalide');
    expect(errors.join(' ')).toContain('déjà utilisé');
    expect(errors.join(' ')).toContain('titre manquant');
  });
  it('sommaire : rubriques dans l\'ordre voulu, pages dans l\'ordre', () => {
    const { pages } = loadWiki(wikiFiles());
    const groups = wikiGroups(pages).map(g => g.group);
    expect(groups).toEqual(['Démarrer', 'Mon profil', 'Mes CV', 'Suivi', 'Conseils', 'Aide']);
    expect(findWikiPage(pages, 'premiers-pas')?.group).toBe('Démarrer');
  });
});

describe('liens internes', () => {
  it('extrait les cibles, avec ou sans ancre', () => {
    expect(internalLinks('voir [a](/aide/profil-remplir) et [b](/aide/exporter#x)')).toEqual(['profil-remplir', 'exporter']);
  });
  it('aucun lien cassé dans le wiki livré', () => {
    const { pages } = loadWiki(wikiFiles());
    expect(brokenWikiLinks(pages)).toEqual([]);
  });
  it('un lien vers une page supprimée est signalé', () => {
    const files = wikiFiles();
    delete files['./wiki/profil-experiences.md'];
    const { pages } = loadWiki(files);
    expect(brokenWikiLinks(pages).some(b => b.endsWith('→ profil-experiences'))).toBe(true);
  });
});

describe('recherche', () => {
  const { pages } = loadWiki(wikiFiles());
  it('retrouve une page connue : « formats de dates »', () => {
    expect(searchWiki(pages, 'formats de dates')[0]?.page.id).toBe('mise-en-page-dates');
    expect(searchWiki(pages, 'Formats de dates')[0]?.page.id).toBe('mise-en-page-dates');
  });
  it('ignore les accents et la casse', () => {
    expect(normalizeSearch('Élégant')).toBe('elegant');
    expect(searchWiki(pages, 'elegant').map(h => h.page.id)).toContain('modeles');
  });
  it('tous les mots doivent figurer ; requête vide : rien', () => {
    expect(searchWiki(pages, 'xyzzy')).toEqual([]);
    expect(searchWiki(pages, 'pdf xyzzy')).toEqual([]);
    expect(searchWiki(pages, '   ')).toEqual([]);
  });
  it('un extrait accompagne chaque résultat', () => {
    const hit = searchWiki(pages, 'word')[0];
    if (hit) expect(hit.snippet.length).toBeGreaterThan(0);
  });
});

describe('IA en premier, sans IA toujours possible', () => {
  const page = (id: string) => readFileSync(join(WIKI_DIR, `${id}.md`), 'utf8');
  it('premiers pas : l\'application n\'envoie rien ; l\'IA choisie peut consulter internet si vous l\'activez', () => {
    const text = page('premiers-pas');
    expect(text).toContain("L'application n'envoie rien sur internet");
    expect(text).toContain("L'IA que vous utilisez peut, elle, consulter internet si vous activez cette option");
  });
  it('CV standard : « Rédiger avec l\'IA » est décrit avant « Composer sans IA »', () => {
    const text = page('creer-cv-standard');
    expect(text.indexOf("**Rédiger avec l'IA**")).toBeGreaterThan(-1);
    expect(text.indexOf('**Composer sans IA**')).toBeGreaterThan(text.indexOf("**Rédiger avec l'IA**"));
    expect(text).not.toContain("Aucune IA n'est nécessaire");
  });
  it('offre : le recours sans IA renvoie vers le CV standard', () => {
    expect(page('adapter-offre')).toContain('**Composer un CV standard sans IA**');
  });
});

describe('récupérer mes données CVmaker', () => {
  const page = (id: string) => readFileSync(join(WIKI_DIR, `${id}.md`), 'utf8');
  it('page rangée dans « Démarrer », juste après l\'import d\'un CV', () => {
    const { pages } = loadWiki(wikiFiles());
    const demarrer = pages.filter(p => p.group === 'Démarrer').map(p => p.id);
    expect(demarrer.indexOf('recuperer-cvmaker')).toBe(demarrer.indexOf('importer-cv') + 1);
  });
  it('décrit l\'export depuis CVmaker, les choix, ce qui n\'est pas repris et la sauvegarde automatique', () => {
    const text = page('recuperer-cvmaker');
    for (const t of ['**Télécharger la sauvegarde**', '**Fusionner** (conseillé)', '**Remplacer**', '**Annuler**', 'La veille emploi', 'ne sont jamais repris', 'copie de vos données actuelles']) {
      expect(text).toContain(t);
    }
    expect(page('importer-cv')).toContain('(/aide/recuperer-cvmaker)');
  });
});
