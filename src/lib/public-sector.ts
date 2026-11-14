/**
 * Détecte un employeur du secteur public.
 *
 * Détection simple, sur les intitulés, domaines et compétences saisis ;
 * aucune IA.
 */

const PUBLIC_SECTOR_RE = new RegExp([
  'fonction publique', 'secteur public', 'emploi public', 'collectivit', 'territorial',
  'mairie', 'commune', 'intercommunal', 'm[ée]tropole', 'd[ée]partement',
  'conseil r[ée]gional', 'centre de gestion', '\\bcdg\\b', '\\bfpt\\b', 'pr[ée]fecture',
  'cnfpt', '\\bccas\\b', '\\bepci\\b', 'administration publique',
].join('|'), 'i');

export function isPublicSectorText(...texts: Array<string | string[] | undefined>): boolean {
  const joined = texts.flatMap(t => (Array.isArray(t) ? t : [t ?? ''])).join(' ');
  return PUBLIC_SECTOR_RE.test(joined);
}
