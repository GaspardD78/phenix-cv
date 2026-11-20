import type { AiCvResponse } from './ai-cv-response';

/**
 * Identifiants recopiés de travers par l'IA.
 *
 * Les entrées du profil ont des identifiants de 32 caractères hexadécimaux.
 * Une IA les recopie souvent mal : majuscules, guillemets ou crochets autour,
 * identifiant tronqué. Sans réparation, toutes les entrées de sa réponse sont
 * ignorées et le CV ne change pas. Un identifiant est rattaché à une entrée
 * seulement sans ambiguïté :
 * - même identifiant, à la casse, aux espaces et aux signes autour près ;
 * - début d'un seul identifiant connu (au moins MIN_PREFIX caractères).
 * Sinon il reste tel quel (le garde-fou le signale comme inconnu).
 */
export const MIN_PREFIX = 8;

const clean = (id: string): string => id.trim().replace(/^[\s"'`[\](){}<>#:]+|[\s"'`[\](){}<>.,;:]+$/g, '').toLowerCase();

export function makeIdResolver(knownIds: readonly string[]): (id: string) => string {
  const known = new Set(knownIds);
  const byClean = new Map<string, string>();
  for (const id of knownIds) byClean.set(clean(id), id);
  return (id: string) => {
    if (known.has(id)) return id;
    const c = clean(id);
    const exact = byClean.get(c);
    if (exact) return exact;
    if (c.length >= MIN_PREFIX) {
      const matches = knownIds.filter(k => clean(k).startsWith(c));
      if (matches.length === 1) return matches[0];
    }
    return id;
  };
}

/** Réponse dont les identifiants recopiés de travers sont rattachés aux entrées connues. */
export function repairAiIds(data: AiCvResponse, knownIds: readonly string[]): { data: AiCvResponse; repaired: number } {
  const resolve = makeIdResolver(knownIds);
  let repaired = 0;
  const fix = (id: string): string => {
    const r = resolve(id);
    if (r !== id) repaired++;
    return r;
  };
  const list = (ids: string[]): string[] => ids.map(fix);
  const out: AiCvResponse = { ...data, entries: data.entries.map(e => ({ ...e, id: fix(e.id) })) };
  if (data.entryOrder) out.entryOrder = list(data.entryOrder);
  if (data.skillGroups) out.skillGroups = data.skillGroups.map(g => ({ ...g, entryIds: list(g.entryIds) }));
  if (data.mergedEntries) out.mergedEntries = data.mergedEntries.map(m => ({ ...m, ids: list(m.ids) }));
  if (data.cvSkills) out.cvSkills = data.cvSkills.map(s => ({ ...s, sources: list(s.sources) }));
  if (data.decisions) out.decisions = data.decisions.map(d => ({ ...d, appui: list(d.appui) }));
  if (data.analyse) {
    out.analyse = {
      ...data.analyse,
      correspondances: data.analyse.correspondances.map(m => (m.entryId ? { ...m, entryId: fix(m.entryId) } : m)),
    };
  }
  return { data: out, repaired };
}
