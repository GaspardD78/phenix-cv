/**
 * Parcours sans IA de l'import d'un tableau de suivi : la personne associe elle-même chaque colonne
 * à un champ (avec des propositions), puis chaque valeur de statut à une colonne du kanban. Pur.
 */
import type { ApplicationStatus } from '@/types/application';
import { IMPORT_FIELDS, type ColumnInfo, type FieldId } from './fields';
import { statusKey, type MappedRow } from './plan';
import type { Table } from './table';
import { DEFAULT_STATUS, detectDateOrder, suggestStatus, type DateOrder } from './values';

/** Champ choisi pour chaque colonne (index de colonne → champ, ou `null` : ne pas importer). */
export type ColumnMapping = Readonly<Record<number, FieldId | null>>;

/** Correspondance de départ : les propositions faites d'après les titres et le contenu. */
export function initialMapping(columns: readonly ColumnInfo[]): ColumnMapping {
  return Object.fromEntries(columns.map(c => [c.index, c.suggested]));
}

/** Choix d'un champ pour une colonne ; un champ ne va qu'à une colonne (l'ancienne est libérée). */
export function setColumnField(mapping: ColumnMapping, column: number, field: FieldId | null): ColumnMapping {
  const next: Record<number, FieldId | null> = { ...mapping };
  if (field) for (const [k, v] of Object.entries(next)) if (v === field) next[Number(k)] = null;
  next[column] = field;
  return next;
}

/** Champs obligatoires sans colonne (entreprise, poste). */
export function missingRequired(mapping: ColumnMapping): FieldId[] {
  const used = new Set(Object.values(mapping));
  return IMPORT_FIELDS.filter(f => f.required && !used.has(f.id)).map(f => f.id);
}

export const MISSING_REQUIRED_MESSAGE = (labels: readonly string[]) => labels.length > 1
  ? `Indiquez quelles colonnes contiennent ${labels.map(l => `« ${l} »`).join(' et ')} : sans elles, une candidature ne peut pas être créée.`
  : `Indiquez quelle colonne contient « ${labels[0]} » : sans elle, une candidature ne peut pas être créée.`;

const columnOf = (mapping: ColumnMapping, field: FieldId): number | null => {
  const entry = Object.entries(mapping).find(([, v]) => v === field);
  return entry ? Number(entry[0]) : null;
};

/** Lignes du tableau rangées par champ (la ligne 1 est la première ligne du tableau). */
export function mappedRows(rows: Table, hasHeader: boolean, mapping: ColumnMapping): MappedRow[] {
  const first = hasHeader ? 1 : 0;
  const pairs = Object.entries(mapping).filter(([, f]) => f) as [string, FieldId][];
  return rows.slice(first).map((row, k) => ({
    line: first + k + 1,
    values: Object.fromEntries(pairs.map(([col, field]) => [field, row[Number(col)] ?? ''])) as Partial<Record<FieldId, string>>,
  }));
}

export interface StatusValue {
  /** Valeur telle qu'écrite (la première rencontrée). */
  value: string;
  /** Clé de rapprochement (sans accents ni majuscules), utilisée par le plan. */
  key: string;
  count: number;
  /** Statut reconnu, ou `null` (inconnu : « Brouillon » par défaut). */
  suggested: ApplicationStatus | null;
}

/** Valeurs distinctes de la colonne « statut », les plus fréquentes d'abord. */
export function statusValues(rows: Table, hasHeader: boolean, mapping: ColumnMapping): StatusValue[] {
  const col = columnOf(mapping, 'status');
  if (col === null) return [];
  const byKey = new Map<string, StatusValue>();
  for (const row of rows.slice(hasHeader ? 1 : 0)) {
    const value = (row[col] ?? '').trim();
    if (!value) continue;
    const key = statusKey(value);
    const known = byKey.get(key);
    if (known) known.count++;
    else byKey.set(key, { value, key, count: 1, suggested: suggestStatus(value) });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'fr'));
}

/** Correspondance des statuts de départ : les propositions, et « Brouillon » pour les inconnus. */
export function initialStatusMap(values: readonly StatusValue[]): Record<string, ApplicationStatus> {
  return Object.fromEntries(values.map(v => [v.key, v.suggested ?? DEFAULT_STATUS]));
}

/** Format des dates proposé d'après les colonnes de dates choisies (français par défaut). */
export function suggestedDateOrder(rows: Table, hasHeader: boolean, mapping: ColumnMapping): { order: DateOrder; ambiguous: boolean; hasDates: boolean } {
  const cols = (['appliedAt', 'nextActionDate'] as const).map(f => columnOf(mapping, f)).filter((c): c is number => c !== null);
  const values = rows.slice(hasHeader ? 1 : 0).flatMap(r => cols.map(c => r[c] ?? ''));
  return { ...detectDateOrder(values), hasDates: cols.length > 0 };
}
