import { useMemo, useState, type ClipboardEvent } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, Copy, FileSpreadsheet, FileUp, Lock, Table2, Wand2, X } from 'lucide-react';
import { AiSiteLinks } from '@/components/shared/AiSiteLinks';
import { useApplicationStore } from '@/stores/applicationStore';
import { useTrackerImportStore } from '@/stores/trackerImportStore';
import { readPastedTable, type Table } from '@/lib/tracker-import/table';
import { ODS_MESSAGE, XLSX_OLD_FORMAT_MESSAGE, readXlsx, trackerFileKind, type XlsxSheet } from '@/lib/tracker-import/xlsx';
import { IMPORT_FIELDS, describeColumns, detectHeaderRow, type ColumnInfo } from '@/lib/tracker-import/fields';
import { buildAiImportPlan, buildTrackerPrompts, parseAiResponse, type AiParseResult, type AiPartResult } from '@/lib/tracker-import/ai';
import { buildImportPlan, type ExistingApplication, type ImportPlan } from '@/lib/tracker-import/plan';
import {
  MISSING_REQUIRED_MESSAGE, initialMapping, initialStatusMap, mappedRows, missingRequired, setColumnField, statusValues, suggestedDateOrder,
  type ColumnMapping,
} from '@/lib/tracker-import/manual';
import type { DateOrder } from '@/lib/tracker-import/values';
import type { FieldId } from '@/lib/tracker-import/fields';
import { APPLICATION_STATUSES, STATUS_LABELS, kanbanColumnOf } from '@/lib/application-labels';
import type { ApplicationStatus } from '@/types/application';
import { TrackerImportPreview } from './TrackerImportPreview';
import { notifyImportDone } from './LastImportBanner';

type Step = 'paste' | 'columns' | 'ai' | 'mapping' | 'statuses' | 'preview';

const contactFields = new Set(IMPORT_FIELDS.filter(f => f.contact).map(f => f.id));
const sample = (c: ColumnInfo) => c.values.filter(v => v.trim()).slice(0, 2).map(v => v.replace(/\n/g, ' ')).join(' · ');

/**
 * « Importer mon suivi » : tableau collé depuis Excel (ou fichier .xlsx ou .csv), puis
 * - avec l'IA (action principale) : choix des colonnes envoyées, texte à copier, réponse à coller ;
 * - sans IA : la personne associe les colonnes aux champs, puis les statuts aux colonnes du kanban ;
 * puis aperçu avant écriture (commun aux deux parcours).
 */
export function TrackerImportDialog({ onClose }: { onClose: () => void }) {
  const applications = useApplicationStore(s => s.applications);
  const [step, setStep] = useState<Step>('paste');
  const [paste, setPaste] = useState<{ html: string | null; text: string }>({ html: null, text: '' });
  /** Classeur .xlsx choisi : ses feuilles, et celle à importer. */
  const [workbook, setWorkbook] = useState<{ fileName: string; sheets: XlsxSheet[]; sheet: number } | null>(null);
  const [reading, setReading] = useState(false);
  const [rows, setRows] = useState<Table>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [keepLocal, setKeepLocal] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);
  // Parcours sans IA.
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [statusMap, setStatusMap] = useState<Record<string, ApplicationStatus>>({});
  const [dateOrder, setDateOrder] = useState<DateOrder>('dmy');
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');

  const columns = useMemo(() => (rows.length ? describeColumns(rows, hasHeader) : []), [rows, hasHeader]);
  const sentColumns = useMemo(() => columns.filter(c => sent.has(c.index)).map(c => ({ index: c.index, header: c.header })), [columns, sent]);
  const parts = useMemo(() => (rows.length ? buildTrackerPrompts(rows, hasHeader, sentColumns) : []), [rows, hasHeader, sentColumns]);
  const results: AiParseResult[] = useMemo(
    () => parts.map((p, k) => (answers[k]?.trim() ? parseAiResponse(answers[k], rows, sentColumns, p) : { ok: false as const, message: '' })),
    [parts, answers, rows, sentColumns],
  );
  const dataRows = rows.length - (hasHeader ? 1 : 0);

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html || text) {
      e.preventDefault();
      setWorkbook(null);
      setPaste({ html: html || null, text });
      setError(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const kind = trackerFileKind(file.name);
    if (kind === 'ods') { setError(ODS_MESSAGE); return; }
    if (kind === 'xls') { setError(XLSX_OLD_FORMAT_MESSAGE); return; }
    if (kind === 'xlsx') {
      setReading(true);
      try {
        const r = await readXlsx(await file.arrayBuffer());
        if (!r.ok) { setError(r.message); return; }
        setWorkbook({ fileName: file.name, sheets: r.sheets, sheet: 0 });
        setPaste({ html: null, text: '' });
        setError(null);
      } catch {
        setError('Impossible de lire ce fichier. Ouvrez-le dans votre tableur, copiez les cellules, puis collez-les ici.');
      } finally {
        setReading(false);
      }
      return;
    }
    setWorkbook(null);
    const reader = new FileReader();
    reader.onload = () => { setPaste({ html: null, text: String(reader.result ?? '') }); setError(null); };
    reader.onerror = () => setError('Impossible de lire ce fichier. Ouvrez-le dans votre tableur, copiez les cellules, puis collez-les ici.');
    reader.readAsText(file);
  };

  /** Lecture du tableau collé ; `null` (et un message) s'il est illisible. */
  const readTable = () => {
    const r = readPastedTable(workbook ? { table: workbook.sheets[workbook.sheet].rows } : paste);
    if (!r.ok) { setError(r.message); return null; }
    const header = detectHeaderRow(r.rows);
    setRows(r.rows);
    setHasHeader(header);
    return { rows: r.rows, header, cols: describeColumns(r.rows, header) };
  };

  /** Parcours sans IA : propositions de correspondance d'après les titres et le contenu. */
  const startManual = () => {
    const t = readTable();
    if (!t) return;
    setMapping(initialMapping(t.cols));
    setDateOrder(suggestedDateOrder(t.rows, t.header, initialMapping(t.cols)).order);
    setMappingError(null);
    setMode('manual');
    setStep('mapping');
  };

  const changeHeader = (value: boolean) => {
    setHasHeader(value);
    if (step === 'mapping') setMapping(initialMapping(describeColumns(rows, value)));
  };

  const manualStatuses = useMemo(() => (step === 'mapping' || step === 'statuses' ? statusValues(rows, hasHeader, mapping) : []), [step, rows, hasHeader, mapping]);
  const dateInfo = useMemo(() => suggestedDateOrder(rows, hasHeader, mapping), [rows, hasHeader, mapping]);

  const manualPreview = (map: Record<string, ApplicationStatus>) => {
    setPlan(buildImportPlan(mappedRows(rows, hasHeader, mapping), applications, { statusMap: map, dateOrder }));
    setStep('preview');
  };

  const afterMapping = () => {
    const missing = missingRequired(mapping);
    if (missing.length) {
      setMappingError(MISSING_REQUIRED_MESSAGE(missing.map(id => IMPORT_FIELDS.find(f => f.id === id)!.label)));
      return;
    }
    setMappingError(null);
    if (manualStatuses.length) {
      setStatusMap(initialStatusMap(manualStatuses));
      setStep('statuses');
    } else {
      manualPreview({});
    }
  };

  /** Lecture du tableau, puis choix des colonnes à envoyer (coordonnées décochées par défaut). */
  const startAi = () => {
    const t = readTable();
    if (!t) return;
    const cols = t.cols;
    setMode('ai');
    setSent(new Set(cols.filter(c => !c.contact).map(c => c.index)));
    setKeepLocal(new Set(cols.filter(c => c.contact && c.suggested && contactFields.has(c.suggested)).map(c => c.index)));
    setAnswers([]);
    setStep('columns');
  };

  const toggle = (set: Set<number>, index: number) => {
    const next = new Set(set);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  };

  const copyPart = async (k: number) => {
    try {
      await navigator.clipboard.writeText(parts[k].prompt);
      setCopied(k);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      toast.error('La copie a échoué. Réessayez, ou sélectionnez le texte à la main.');
    }
  };

  const toPreview = () => {
    const ok = results.filter((r): r is AiPartResult => r.ok);
    const local = columns
      .filter(c => !sent.has(c.index) && keepLocal.has(c.index) && c.suggested && contactFields.has(c.suggested))
      .map(c => ({ index: c.index, field: c.suggested! }));
    const existing: ExistingApplication[] = applications;
    setPlan(buildAiImportPlan(ok, rows, local, existing));
    setStep('preview');
  };

  const confirm = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const result = await useTrackerImportStore.getState().runImport(plan);
      notifyImportDone(result);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'L\'import n\'a pas pu aller au bout.');
    } finally {
      setBusy(false);
    }
  };

  const allParsed = results.length > 0 && results.every(r => r.ok);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tracker-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" data-testid="tracker-import-dialog">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-card)] p-6 shadow-2xl text-[var(--pc-text)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="tracker-import-title" className="text-lg font-bold">Importer mon suivi</h2>
            <p className="text-sm text-[var(--pc-muted)]">Depuis Excel, Google Sheets ou LibreOffice. Rien n'est enregistré avant l'aperçu.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-[var(--pc-muted)] hover:text-[var(--pc-text)]"><X size={20} /></button>
        </div>

        {step === 'paste' && (
          <div className="space-y-4" data-testid="step-paste">
            <label htmlFor="tracker-paste" className="block text-sm font-semibold">1. Collez votre tableau, ou choisissez un fichier</label>
            <p className="text-xs text-[var(--pc-muted)] -mt-3">Dans votre tableur, sélectionnez les cellules, titres compris, copiez-les (Ctrl+C), puis collez-les ici (Ctrl+V).</p>
            {workbook ? (
              <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] p-3 space-y-2 text-sm" data-testid="workbook-loaded">
                <p className="flex items-start gap-2">
                  <FileSpreadsheet className="w-4 h-4 mt-0.5 shrink-0 text-[var(--pc-accent)]" aria-hidden />
                  <span>
                    Fichier <strong>{workbook.fileName}</strong> lu :{' '}
                    {workbook.sheets.length > 1 ? `${workbook.sheets.length} feuilles avec des données.` : `feuille « ${workbook.sheets[0].name} ».`}
                  </span>
                </p>
                {workbook.sheets.length > 1 && (
                  <label className="flex items-center gap-2">
                    <span>Feuille à importer :</span>
                    <select value={workbook.sheet} onChange={e => { setWorkbook({ ...workbook, sheet: Number(e.target.value) }); setError(null); }}
                      className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] px-2 py-1" data-testid="workbook-sheet">
                      {workbook.sheets.map((sh, k) => <option key={k} value={k}>{sh.name}</option>)}
                    </select>
                  </label>
                )}
                <button type="button" className="text-xs text-[var(--pc-muted)] hover:underline" onClick={() => { setWorkbook(null); setError(null); }}>
                  Retirer ce fichier et coller un tableau à la place
                </button>
              </div>
            ) : (
              <textarea id="tracker-paste" rows={7} value={paste.text} onPaste={onPaste}
                onChange={e => { setPaste({ html: null, text: e.target.value }); setError(null); }}
                className="w-full rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] p-2 text-xs font-mono"
                placeholder="Collez ici les cellules de votre tableau…" />
            )}
            <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-[var(--pc-accent)] hover:underline">
              <FileUp className="w-4 h-4" aria-hidden /> {reading ? 'Lecture du fichier…' : 'ou choisissez un fichier Excel (.xlsx) ou .csv'}
              <input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt,.ods,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
                onChange={e => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}
            <button type="button" className="pc-btn-primary w-full justify-center" onClick={startAi} disabled={!workbook && !paste.text.trim() && !paste.html} data-testid="import-with-ai">
              <Wand2 className="w-4 h-4" aria-hidden /> Importer avec l'IA
            </button>
            <AiSiteLinks />
            <button type="button" className="pc-btn-secondary w-full justify-center" onClick={startManual} disabled={!workbook && !paste.text.trim() && !paste.html} data-testid="import-without-ai">
              <Table2 className="w-4 h-4" aria-hidden /> Importer sans IA
            </button>
            <p className="text-xs text-center text-[var(--pc-muted)] -mt-2">Sans IA, vous indiquez vous-même à quoi correspond chaque colonne.</p>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4" data-testid="step-mapping">
            <div>
              <h3 className="text-base font-semibold">2. À quoi correspond chaque colonne ?</h3>
              <p className="text-sm text-[var(--pc-muted)]">{dataRows} ligne{dataRows > 1 ? 's' : ''} lue{dataRows > 1 ? 's' : ''}. Nous avons fait des propositions d'après vos titres : vérifiez-les.</p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={hasHeader} onChange={e => changeHeader(e.target.checked)} /> Ma première ligne contient les titres des colonnes
            </label>
            <ul className="divide-y divide-[var(--pc-border)] rounded-lg border border-[var(--pc-border)]">
              {columns.map(c => (
                <li key={c.index} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" data-testid={`mapping-${c.index}`}>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{c.header}</span>
                    <span className="block text-xs text-[var(--pc-muted)] truncate">{sample(c) || '(vide)'}</span>
                  </span>
                  <select aria-label={`Champ pour la colonne ${c.header}`} value={mapping[c.index] ?? ''}
                    onChange={e => setMapping(m => setColumnField(m, c.index, (e.target.value || null) as FieldId | null))}
                    className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] p-1.5 text-sm">
                    <option value="">Ne pas importer</option>
                    {IMPORT_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}{f.required ? ' (obligatoire)' : ''}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            {dateInfo.hasDates && (
              <fieldset className="text-sm" data-testid="date-order">
                <legend className="font-semibold mb-1">Format des dates</legend>
                {(['dmy', 'mdy'] as const).map(o => (
                  <label key={o} className="mr-4 inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="date-order" checked={dateOrder === o} onChange={() => setDateOrder(o)} />
                    {o === 'dmy' ? 'Jour/mois/année (12/03/2026 = 12 mars)' : 'Mois/jour/année (03/12/2026 = 12 mars)'}
                  </label>
                ))}
              </fieldset>
            )}
            {mappingError && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{mappingError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="pc-btn-secondary" onClick={() => setStep('paste')}>Retour</button>
              <button type="button" className="pc-btn-primary" onClick={afterMapping} data-testid="mapping-continue">Continuer</button>
            </div>
          </div>
        )}

        {step === 'statuses' && (
          <div className="space-y-4" data-testid="step-statuses">
            <div>
              <h3 className="text-base font-semibold">3. Dans quelle colonne du suivi ranger chaque statut ?</h3>
              <p className="text-sm text-[var(--pc-muted)]">Vérifiez nos propositions. Un statut que nous ne reconnaissons pas va dans « Brouillon » : changez-le si besoin.</p>
            </div>
            <ul className="divide-y divide-[var(--pc-border)] rounded-lg border border-[var(--pc-border)]">
              {manualStatuses.map(v => (
                <li key={v.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    « {v.value} » <span className="text-xs text-[var(--pc-muted)]">({v.count} ligne{v.count > 1 ? 's' : ''})</span>
                    {!v.suggested && <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="w-3 h-3" aria-hidden /> non reconnu</span>}
                  </span>
                  <select aria-label={`Statut pour « ${v.value} »`} value={statusMap[v.key] ?? 'draft'}
                    onChange={e => setStatusMap(m => ({ ...m, [v.key]: e.target.value as ApplicationStatus }))}
                    className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] p-1.5 text-sm">
                    {APPLICATION_STATUSES.map(st => <option key={st} value={st}>{STATUS_LABELS[st]} (colonne {kanbanColumnOf(st).title})</option>)}
                  </select>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button type="button" className="pc-btn-secondary" onClick={() => setStep('mapping')}>Retour</button>
              <button type="button" className="pc-btn-primary" onClick={() => manualPreview(statusMap)} data-testid="statuses-continue">Voir l'aperçu</button>
            </div>
          </div>
        )}

        {step === 'columns' && (
          <div className="space-y-4" data-testid="step-columns">
            <div>
              <h3 className="text-base font-semibold">2. Colonnes envoyées à l'IA</h3>
              <p className="text-sm text-[var(--pc-muted)]">{dataRows} ligne{dataRows > 1 ? 's' : ''} lue{dataRows > 1 ? 's' : ''}. Décochez ce que vous ne voulez pas confier à l'IA.</p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={hasHeader} onChange={e => setHasHeader(e.target.checked)} /> Ma première ligne contient les titres des colonnes
            </label>
            {columns.some(c => c.contact) && (
              <p className="flex items-start gap-2 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-accent-subtle)] p-3 text-sm" data-testid="privacy-note">
                <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
                <span>Les colonnes qui semblent contenir des coordonnées (e-mail, téléphone, nom d'une personne) ne sont pas envoyées à l'IA. Vous pouvez quand même les importer : elles sont lues sur votre ordinateur, ligne par ligne.</span>
              </p>
            )}
            <ul className="divide-y divide-[var(--pc-border)] rounded-lg border border-[var(--pc-border)]">
              {columns.map(c => (
                <li key={c.index} className="px-3 py-2 text-sm" data-testid={`column-${c.index}`}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={sent.has(c.index)} onChange={() => setSent(s => toggle(s, c.index))} />
                    <span className="min-w-0">
                      <span className="font-medium">{c.header}</span>
                      {c.contact && <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-[var(--pc-surface)] border border-[var(--pc-border)]">coordonnées</span>}
                      <span className="block text-xs text-[var(--pc-muted)] truncate">{sample(c) || '(vide)'}</span>
                    </span>
                  </label>
                  {!sent.has(c.index) && c.contact && c.suggested && contactFields.has(c.suggested) && (
                    <label className="ml-6 mt-1 flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={keepLocal.has(c.index)} onChange={() => setKeepLocal(s => toggle(s, c.index))} />
                      Importer quand même cette colonne depuis votre ordinateur, sans l'envoyer à l'IA
                    </label>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button type="button" className="pc-btn-secondary" onClick={() => setStep('paste')}>Retour</button>
              <button type="button" className="pc-btn-primary" onClick={() => setStep('ai')} disabled={sentColumns.length === 0}>Continuer</button>
            </div>
          </div>
        )}

        {step === 'ai' && (
          <div className="space-y-4" data-testid="step-ai">
            <div>
              <h3 className="text-base font-semibold">3. Faire ranger le tableau par l'IA</h3>
              <p className="text-sm text-[var(--pc-muted)]">
                {parts.length > 1
                  ? `Votre tableau est découpé en ${parts.length} parties. Pour chacune : copiez le texte, collez-le dans l'IA, puis recollez sa réponse ici.`
                  : 'Copiez le texte, collez-le dans l\'IA de votre choix, puis recollez sa réponse ici.'}
              </p>
            </div>
            <AiSiteLinks />
            {parts.map((p, k) => {
              const r = results[k];
              return (
                <section key={p.index} className="rounded-lg border border-[var(--pc-border)] p-3 space-y-2" data-testid={`part-${p.index}`}>
                  <button type="button" onClick={() => void copyPart(k)}
                    className={`w-full justify-center ${r.ok ? 'pc-btn-secondary' : 'pc-btn-primary'}`}>
                    {copied === k ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
                    {copied === k ? 'Texte copié' : parts.length > 1 ? `Copier le texte (partie ${p.index} sur ${p.count}, lignes ${p.lines[0]} à ${p.lines[p.lines.length - 1]})` : 'Copier le texte pour l\'IA'}
                  </button>
                  <textarea rows={4} value={answers[k] ?? ''} aria-label={`Réponse de l'IA, partie ${p.index}`}
                    onChange={e => setAnswers(a => { const next = [...a]; next[k] = e.target.value; return next; })}
                    className="w-full rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] p-2 text-xs font-mono"
                    placeholder="Collez ici la réponse de l'IA…" />
                  {r.ok
                    ? <p className="text-xs text-green-700">✓ {r.rows.length} ligne{r.rows.length > 1 ? 's' : ''} lue{r.rows.length > 1 ? 's' : ''}{r.missingLines.length ? `, ${r.missingLines.length} oubliée${r.missingLines.length > 1 ? 's' : ''} par l'IA` : ''}.</p>
                    : r.message && <p className="text-xs text-red-700">{r.message}</p>}
                </section>
              );
            })}
            <div className="flex justify-end gap-2">
              <button type="button" className="pc-btn-secondary" onClick={() => setStep('columns')}>Retour</button>
              <button type="button" className="pc-btn-primary" onClick={toPreview} disabled={!allParsed} data-testid="to-preview">Voir l'aperçu</button>
            </div>
          </div>
        )}

        {step === 'preview' && plan && (
          <TrackerImportPreview plan={plan} onChange={setPlan} onConfirm={() => void confirm()} onBack={() => setStep(mode === 'ai' ? 'ai' : statusValues(rows, hasHeader, mapping).length ? 'statuses' : 'mapping')} busy={busy} />
        )}
      </div>
    </div>
  );
}
