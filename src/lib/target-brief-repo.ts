/**
 * Cache des fiches « Ce que le marché attend » (table `target_briefs`, migration 002), par profil
 * et par clé métier + secteur + entreprise. La fiche stockée est celle que la personne a validée,
 * corrections comprises. Relue, elle repasse par le contrôle : une ligne abîmée ou modifiée à la
 * main ne peut pas introduire d'élément sans source.
 */
import { getDb } from './db';
import { briefKey, validateTargetBrief, type TargetBrief } from './target-brief';

export interface BriefDb {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
}

export interface BriefQuery { role: string; sector?: string; company?: string }

interface Row { brief: string }

/** Fiche en cache, ou `null` (absente, ou illisible : elle sera refaite). */
export async function loadBrief(profileId: string, query: BriefQuery, db?: BriefDb): Promise<TargetBrief | null> {
  const d = db ?? await getDb() as unknown as BriefDb;
  const rows = await d.select<Row[]>('SELECT brief FROM target_briefs WHERE profile_id = ?1 AND cache_key = ?2', [profileId, briefKey(query)]);
  if (!rows.length) return null;
  try {
    const { brief, report } = validateTargetBrief(JSON.parse(rows[0].brief) as unknown);
    return report.usable ? brief : null;
  } catch {
    return null;
  }
}

/** Enregistre (ou remplace) la fiche d'un métier. */
export async function saveBrief(profileId: string, query: BriefQuery, brief: TargetBrief, db?: BriefDb): Promise<void> {
  const d = db ?? await getDb() as unknown as BriefDb;
  await d.execute(
    `INSERT INTO target_briefs (profile_id, cache_key, role, sector, company, brief, researched_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(profile_id, cache_key) DO UPDATE SET role = ?3, sector = ?4, company = ?5, brief = ?6, researched_at = ?7, updated_at = datetime('now')`,
    [profileId, briefKey(query), query.role, query.sector ?? null, query.company ?? null, JSON.stringify(brief), brief.researchedAt],
  );
}

/** Oublie la fiche d'un métier (bouton « Actualiser » : la recherche repart de zéro). */
export async function deleteBrief(profileId: string, query: BriefQuery, db?: BriefDb): Promise<void> {
  const d = db ?? await getDb() as unknown as BriefDb;
  await d.execute('DELETE FROM target_briefs WHERE profile_id = ?1 AND cache_key = ?2', [profileId, briefKey(query)]);
}
