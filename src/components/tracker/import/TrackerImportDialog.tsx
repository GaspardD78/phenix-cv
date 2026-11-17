import { useMemo, useState, type ClipboardEvent } from 'react';
import { toast } from 'sonner';
import { Check, Copy, FileUp, Lock, Wand2, X } from 'lucide-react';
import { AiSiteLinks } from '@/components/shared/AiSiteLinks';
import { useApplicationStore } from '@/stores/applicationStore';
import { useTrackerImportStore } from '@/stores/trackerImportStore';
import { readPastedTable, type Table } from '@/lib/tracker-import/table';
import { IMPORT_FIELDS, describeColumns, detectHeaderRow, type ColumnInfo } from '@/lib/tracker-import/fields';
import { buildAiImportPlan, buildTrackerPrompts, parseAiResponse, type AiParseResult, type AiPartResult } from '@/lib/tracker-import/ai';
import type { ExistingApplication, ImportPlan } from '@/lib/tracker-import/plan';
import { TrackerImportPreview } from './TrackerImportPreview';
import { notifyImportDone } from './LastImportBanner';

type Step = 'paste' | 'columns' | 'ai' | 'preview';

const contactFields = new Set(IMPORT_FIELDS.filter(f => f.contact).map(f => f.id));
const sample = (c: ColumnInfo) => c.values.filter(v => v.trim()).slice(0, 2).map(v => v.replace(/\n/g, ' ')).join(' · ');

/**
 * « Importer mon suivi » : tableau collé depuis Excel (ou fichier .csv), puis import avec l'IA
 * (choix des colonnes envoyées, texte à copier, réponse à coller), puis aperçu avant écriture.
 */
export function TrackerImportDialog({ onClose }: { onClose: () => void }) {
  const applications = useApplicationStore(s => s.applications);
  const [step, setStep] = useState<Step>('paste');
  const [paste, setPaste] = useState<{ html: string | null; text: string }>({ html: null, text: '' });
  const [rows, setRows] = useState<Table>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [keepLocal, setKeepLocal] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);

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
      setPaste({ html: html || null, text });
      setError(null);
    }
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setPaste({ html: null, text: String(reader.result ?? '') }); setError(null); };
    reader.onerror = () => setError('Impossible de lire ce fichier. Ouvrez-le dans votre tableur, copiez les cellules, puis collez-les ici.');
    reader.readAsText(file);
  };

  /** Lecture du tableau, puis choix des colonnes à envoyer (coordonnées décochées par défaut). */
  const startAi = () => {
    const r = readPastedTable(paste);
    if (!r.ok) { setError(r.message); return; }
    const header = detectHeaderRow(r.rows);
    const cols = describeColumns(r.rows, header);
    setRows(r.rows);
    setHasHeader(header);
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
            <label htmlFor="tracker-paste" className="block text-sm font-semibold">1. Collez votre tableau</label>
            <p className="text-xs text-[var(--pc-muted)] -mt-3">Dans votre tableur, sélectionnez les cellules, titres compris, copiez-les (Ctrl+C), puis collez-les ici (Ctrl+V).</p>
            <textarea id="tracker-paste" rows={7} value={paste.text} onPaste={onPaste}
              onChange={e => { setPaste({ html: null, text: e.target.value }); setError(null); }}
              className="w-full rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] p-2 text-xs font-mono"
              placeholder="Collez ici les cellules de votre tableau…" />
            <label className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-[var(--pc-accent)] hover:underline">
              <FileUp className="w-4 h-4" aria-hidden /> ou choisissez un fichier .csv
              <input type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
            </label>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}
            <button type="button" className="pc-btn-primary w-full justify-center" onClick={startAi} disabled={!paste.text.trim() && !paste.html} data-testid="import-with-ai">
              <Wand2 className="w-4 h-4" aria-hidden /> Importer avec l'IA
            </button>
            <AiSiteLinks />
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
          <TrackerImportPreview plan={plan} onChange={setPlan} onConfirm={() => void confirm()} onBack={() => setStep('ai')} busy={busy} />
        )}
      </div>
    </div>
  );
}
