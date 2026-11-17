/**
 * Plan d'import d'un tableau de suivi : chaque ligne devient une candidature prête, une ligne
 * en erreur ou un doublon possible, avant toute écriture. Commun aux parcours avec et sans IA. Pur.
 *
 * Règles : rien n'est inventé (valeur illisible → vide + alerte), une date sans jour est marquée
 * approximative (alerte, et mention dans les notes), un statut inconnu va en « Brouillon » (alerte).
 */
import type { Application, ApplicationStatus } from '@/types/application';
import { KANBAN_COLUMNS, STATUS_LABELS, kanbanColumnOf } from '@/lib/application-labels';
import { IMPORT_FIELDS, normalizeText, type FieldId } from './fields';
import { DEFAULT_STATUS, parseDateCell, parseSalary, suggestSource, suggestStatus, type DateOrder } from './values';

/** Une ligne du tableau, déjà rangée par champ (texte brut des cellules). */
export interface MappedRow {
  /** Numéro de la ligne dans le tableau d'origine (1 = première ligne). */
  line: number;
  values: Partial<Record<FieldId, string>>;
}

/** Candidature à créer : colonnes de la table `applications` (hors identifiant et dates techniques). */
export interface NewApplicationRow {
  company_name: string;
  job_title: string;
  status: ApplicationStatus;
  applied_at: string | null;
  job_url: string | null;
  source: Application['source'];
  source_detail: string | null;
  location: string | null;
  remote_policy: string | null;
  salary_min: number | null;
  salary_max: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  job_description: string | null;
  priority: 1 | 2 | 3;
}

/** Candidature déjà présente dans le suivi (pour les doublons et la fusion). */
export type ExistingApplication = Pick<Application, 'id' | 'companyName' | 'jobTitle' | 'appliedAt' | 'createdAt'>
  & Partial<Pick<Application, 'jobUrl' | 'source' | 'sourceDetail' | 'location' | 'remotePolicy' | 'salaryMin' | 'salaryMax'
    | 'contactName' | 'contactEmail' | 'contactPhone' | 'nextAction' | 'nextActionDate' | 'notes' | 'jobDescription'>>;

export type DuplicateDecision = 'ignore' | 'merge' | 'add';

export type DuplicateOf =
  | { kind: 'existing'; id: string; label: string; date: string | null }
  | { kind: 'file'; line: number; label: string };

export interface PlanItem {
  line: number;
  /** Candidature prête ; absente si la ligne est en erreur. */
  row: NewApplicationRow | null;
  /** Raison pour laquelle la ligne ne peut pas être importée. */
  error: string | null;
  /** Remarques sur des valeurs converties ou laissées vides. */
  alerts: string[];
  duplicateOf: DuplicateOf | null;
  /** Choix pour un doublon (par défaut : ignorer). Sans doublon : toujours « add ». */
  decision: DuplicateDecision;
}

export interface ImportPlan {
  items: PlanItem[];
}

export interface PlanOptions {
  /** Statut choisi par la personne pour chaque valeur de la colonne « statut » (clé : valeur normalisée). */
  statusMap?: Readonly<Record<string, ApplicationStatus>>;
  dateOrder?: DateOrder;
}

/** Écart maximal entre deux dates de candidature pour parler de doublon. */
export const DUPLICATE_WINDOW_DAYS = 14;

const clean = (v: string | undefined): string | null => {
  const t = (v ?? '').replace(/\r\n?/g, '\n').trim();
  return t ? t : null;
};

export const statusKey = (raw: string) => normalizeText(raw);

const days = (a: string, b: string) => Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 86400000;

/** Même entreprise et même poste (sans accents ni majuscules), dates proches ou inconnues. */
export function isSameApplication(
  a: { company: string; title: string; date: string | null },
  b: { company: string; title: string; date: string | null },
): boolean {
  if (normalizeText(a.company) !== normalizeText(b.company) || normalizeText(a.title) !== normalizeText(b.title)) return false;
  if (!a.date || !b.date) return true;
  const gap = days(a.date, b.date);
  return Number.isNaN(gap) || gap <= DUPLICATE_WINDOW_DAYS;
}

const fieldLabel = (id: FieldId) => IMPORT_FIELDS.find(f => f.id === id)?.label ?? id;

/** Conversion d'une ligne en candidature, avec ses alertes. */
export function convertRow(row: MappedRow, opts: PlanOptions = {}): { row: NewApplicationRow | null; error: string | null; alerts: string[] } {
  const v = row.values;
  const alerts: string[] = [];
  const notes: string[] = [];
  const company = clean(v.companyName);
  const title = clean(v.jobTitle);
  if (!company && !title) return { row: null, error: 'Ni entreprise ni poste : ligne ignorée.', alerts };
  if (!company) return { row: null, error: 'Pas de nom d\'entreprise : ligne ignorée.', alerts };
  if (!title) return { row: null, error: 'Pas d\'intitulé de poste : ligne ignorée.', alerts };

  // Statut : choix de la personne, sinon reconnaissance, sinon « Brouillon ».
  let status: ApplicationStatus = DEFAULT_STATUS;
  const rawStatus = clean(v.status);
  if (rawStatus) {
    const chosen = opts.statusMap?.[statusKey(rawStatus)] ?? suggestStatus(rawStatus);
    if (chosen) status = chosen;
    else alerts.push(`Statut « ${rawStatus} » inconnu : rangé dans « ${STATUS_LABELS[DEFAULT_STATUS]} ».`);
  }

  const date = (field: 'appliedAt' | 'nextActionDate') => {
    const raw = clean(v[field]);
    if (!raw) return null;
    const d = parseDateCell(raw, opts.dateOrder ?? 'dmy');
    if (d.message) alerts.push(`${fieldLabel(field)} : ${d.message}`);
    if (d.approximate) notes.push(`${fieldLabel(field)} approximative : « ${raw} ».`);
    return d.value;
  };
  const appliedAt = date('appliedAt');
  const nextActionDate = date('nextActionDate');

  const { source, detail } = suggestSource(v.source ?? '');

  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  const rawSalary = clean(v.salary);
  if (rawSalary) {
    const s = parseSalary(rawSalary);
    if (s) { salaryMin = s.min; salaryMax = s.max; }
    else {
      alerts.push(`Salaire « ${rawSalary} » illisible : gardé dans les notes.`);
      notes.push(`Salaire : ${rawSalary}`);
    }
  }

  const ownNotes = clean(v.notes);
  const allNotes = [ownNotes, ...notes].filter(Boolean).join('\n');

  return {
    error: null,
    alerts,
    row: {
      company_name: company,
      job_title: title,
      status,
      applied_at: appliedAt,
      job_url: clean(v.jobUrl),
      source,
      source_detail: detail,
      location: clean(v.location),
      remote_policy: clean(v.remotePolicy),
      salary_min: salaryMin,
      salary_max: salaryMax,
      contact_name: clean(v.contactName),
      contact_email: clean(v.contactEmail),
      contact_phone: clean(v.contactPhone),
      next_action: clean(v.nextAction),
      next_action_date: nextActionDate,
      notes: allNotes || null,
      job_description: clean(v.jobDescription),
      priority: 2,
    },
  };
}

const formatDate = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : null);

/** Plan complet : conversion, puis doublons (avec le suivi existant, puis à l'intérieur du fichier). */
export function buildImportPlan(rows: readonly MappedRow[], existing: readonly ExistingApplication[], opts: PlanOptions = {}): ImportPlan {
  const items: PlanItem[] = [];
  for (const r of rows) {
    const { row, error, alerts } = convertRow(r, opts);
    let duplicateOf: DuplicateOf | null = null;
    if (row) {
      const me = { company: row.company_name, title: row.job_title, date: row.applied_at };
      const twin = existing.find(e => isSameApplication(me, { company: e.companyName, title: e.jobTitle, date: e.appliedAt ?? e.createdAt }));
      if (twin) {
        duplicateOf = { kind: 'existing', id: twin.id, label: `${twin.companyName} – ${twin.jobTitle}`, date: formatDate(twin.appliedAt ?? twin.createdAt) };
      } else {
        const earlier = items.find(i => i.row && i.decision !== 'ignore'
          && isSameApplication(me, { company: i.row.company_name, title: i.row.job_title, date: i.row.applied_at }));
        if (earlier) duplicateOf = { kind: 'file', line: earlier.line, label: `${row.company_name} – ${row.job_title}` };
      }
    }
    items.push({ line: r.line, row, error, alerts, duplicateOf, decision: duplicateOf ? 'ignore' : 'add' });
  }
  return { items };
}

export interface PlanSummary {
  total: number;
  /** Lignes qui seront écrites (ajoutées ou fusionnées). */
  ready: number;
  added: number;
  merged: number;
  ignored: number;
  errors: number;
  duplicates: number;
  alerts: number;
  /** Candidatures ajoutées par colonne du kanban, dans l'ordre des colonnes. */
  byColumn: { title: string; count: number }[];
}

export function summarizePlan(plan: ImportPlan): PlanSummary {
  const added = plan.items.filter(i => i.row && i.decision === 'add');
  const merged = plan.items.filter(i => i.row && i.decision === 'merge' && i.duplicateOf?.kind === 'existing');
  const errors = plan.items.filter(i => i.error).length;
  const counts = new Map<string, number>();
  for (const i of added) {
    const col = kanbanColumnOf(i.row!.status).title;
    counts.set(col, (counts.get(col) ?? 0) + 1);
  }
  return {
    total: plan.items.length,
    ready: added.length + merged.length,
    added: added.length,
    merged: merged.length,
    ignored: plan.items.length - errors - added.length - merged.length,
    errors,
    duplicates: plan.items.filter(i => i.duplicateOf).length,
    alerts: plan.items.reduce((n, i) => n + i.alerts.length, 0),
    byColumn: KANBAN_COLUMNS.map(c => ({ title: c.title, count: counts.get(c.title) ?? 0 })).filter(c => c.count > 0),
  };
}

/** Changement de décision pour un doublon (une ligne sans doublon reste « add »). */
export function withDecision(plan: ImportPlan, line: number, decision: DuplicateDecision): ImportPlan {
  return {
    items: plan.items.map(i => {
      if (i.line !== line || !i.duplicateOf || !i.row) return i;
      // Fusion possible seulement avec une candidature déjà dans le suivi.
      const next = decision === 'merge' && i.duplicateOf.kind !== 'existing' ? 'add' : decision;
      return { ...i, decision: next };
    }),
  };
}

/** Colonnes complétées lors d'une fusion : seulement si elles sont vides dans le suivi. */
export const MERGE_FIELDS = [
  'job_url', 'source', 'source_detail', 'location', 'remote_policy', 'salary_min', 'salary_max', 'contact_name',
  'contact_email', 'contact_phone', 'next_action', 'next_action_date', 'job_description',
] as const;
