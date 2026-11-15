/**
 * Wiki intégré : lecture des pages Markdown, liens internes, recherche plein texte.
 * Fonctions pures (aucun accès au disque ni au réseau) : les fichiers sont fournis par l'appelant,
 * ce qui permet de les tester avec bun et de les charger avec Vite (import.meta.glob) dans l'application.
 */

export interface WikiPage {
  /** Identifiant stable : c'est aussi l'ancre (`/aide/<id>`). */
  id: string;
  title: string;
  /** Rubrique du sommaire (ex. « Mon profil »). */
  group: string;
  /** Rang dans la rubrique. */
  order: number;
  /** Corps Markdown, sans les métadonnées. */
  body: string;
}

export interface WikiLoadResult {
  pages: WikiPage[];
  errors: string[];
}

export const WIKI_GROUP_ORDER = ['Démarrer', 'Mon profil', 'Mes CV', 'Suivi', 'Conseils', 'Aide'] as const;

/** Lit l'en-tête `---` d'un fichier Markdown (clés simples `cle: valeur`). */
export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

/** Construit le wiki à partir des fichiers (`chemin → contenu`). Les erreurs sont listées, pas levées. */
export function loadWiki(files: Record<string, string>): WikiLoadResult {
  const pages: WikiPage[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [path, raw] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const { meta, body } = parseFrontmatter(raw);
    const id = meta.id ?? '';
    if (!/^[a-z0-9-]+$/.test(id)) { errors.push(`${path} : identifiant « ${id} » invalide (minuscules, chiffres et tirets)`); continue; }
    if (seen.has(id)) { errors.push(`${path} : identifiant « ${id} » déjà utilisé`); continue; }
    if (!meta.title) errors.push(`${path} : titre manquant`);
    if (!meta.group) errors.push(`${path} : rubrique manquante`);
    seen.add(id);
    pages.push({ id, title: meta.title ?? id, group: meta.group ?? 'Aide', order: Number(meta.order ?? 99), body: body.trim() });
  }
  pages.sort((a, b) => groupRank(a.group) - groupRank(b.group) || a.order - b.order);
  return { pages, errors };
}

function groupRank(group: string): number {
  const i = (WIKI_GROUP_ORDER as readonly string[]).indexOf(group);
  return i < 0 ? 99 : i;
}

/** Sommaire : rubriques dans l'ordre, avec leurs pages. */
export function wikiGroups(pages: readonly WikiPage[]): { group: string; pages: WikiPage[] }[] {
  const out: { group: string; pages: WikiPage[] }[] = [];
  for (const p of pages) {
    const last = out[out.length - 1];
    if (last && last.group === p.group) last.pages.push(p);
    else out.push({ group: p.group, pages: [p] });
  }
  return out;
}

export function findWikiPage(pages: readonly WikiPage[], id: string | undefined): WikiPage | undefined {
  return id ? pages.find(p => p.id === id) : undefined;
}

/** Cibles des liens internes `](/aide/<id>)` d'une page. */
export function internalLinks(body: string): string[] {
  return [...body.matchAll(/\]\(\/aide\/([^)\s#]+)(?:#[^)\s]*)?\)/g)].map(m => m[1]);
}

/** Liens internes qui ne mènent à aucune page (vide = aucun lien cassé). */
export function brokenWikiLinks(pages: readonly WikiPage[]): string[] {
  const ids = new Set(pages.map(p => p.id));
  const broken: string[] = [];
  for (const p of pages) {
    for (const target of internalLinks(p.body)) {
      if (!ids.has(target)) broken.push(`${p.id} → ${target}`);
    }
  }
  return broken;
}

/** Minuscules, sans accents ni ponctuation : « Dates » et « dates » se retrouvent. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface WikiSearchHit {
  page: WikiPage;
  score: number;
  snippet: string;
}

/**
 * Recherche : chaque mot de la requête doit apparaître dans la page (titre, rubrique ou texte).
 * Le titre compte plus que le texte. Le résultat contient un extrait autour du premier mot trouvé.
 */
export function searchWiki(pages: readonly WikiPage[], query: string): WikiSearchHit[] {
  const words = normalizeSearch(query).split(' ').filter(w => w.length >= 2);
  if (words.length === 0) return [];
  const hits: WikiSearchHit[] = [];
  for (const page of pages) {
    const title = normalizeSearch(page.title);
    const group = normalizeSearch(page.group);
    const body = normalizeSearch(page.body);
    let score = 0;
    let ok = true;
    for (const w of words) {
      const inTitle = title.includes(w);
      const inGroup = group.includes(w);
      const count = body.split(w).length - 1;
      if (!inTitle && !inGroup && count === 0) { ok = false; break; }
      score += (inTitle ? 10 : 0) + (inGroup ? 3 : 0) + Math.min(count, 5);
    }
    if (!ok) continue;
    hits.push({ page, score, snippet: snippetFor(page.body, words[0]) });
  }
  return hits.sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title));
}

function snippetFor(body: string, word: string): string {
  const plain = body.replace(/[#*`[\]()]/g, '').replace(/\s+/g, ' ');
  const at = normalizeSearch(plain).indexOf(word);
  if (at < 0) return plain.slice(0, 140);
  const start = Math.max(0, at - 50);
  return (start > 0 ? '… ' : '') + plain.slice(start, start + 160).trim();
}
