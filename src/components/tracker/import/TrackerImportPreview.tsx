import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Copy, XCircle } from 'lucide-react';
import { summarizePlan, withDecision, type DuplicateDecision, type ImportPlan } from '@/lib/tracker-import/plan';

const DECISION_LABELS: Record<DuplicateDecision, string> = {
  ignore: 'Ignorer',
  merge: 'Fusionner (compléter les champs vides)',
  add: 'Ajouter quand même',
};

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/**
 * Aperçu avant import, commun aux parcours avec et sans IA : lignes prêtes, statuts par colonne du
 * kanban, lignes en erreur avec leur raison, alertes, doublons avec le choix ignorer / fusionner / ajouter.
 * Rien n'est écrit avant « Importer ».
 */
export function TrackerImportPreview({ plan, onChange, onConfirm, onBack, busy = false }: {
  plan: ImportPlan;
  onChange: (plan: ImportPlan) => void;
  onConfirm: () => void;
  onBack: () => void;
  busy?: boolean;
}) {
  const summary = summarizePlan(plan);
  const [showAlerts, setShowAlerts] = useState(false);
  const errors = plan.items.filter(i => i.error);
  const duplicates = plan.items.filter(i => i.duplicateOf && i.row);
  const alerts = plan.items.filter(i => i.row && i.alerts.length > 0);

  return (
    <div className="space-y-4" data-testid="tracker-import-preview">
      <div>
        <h3 className="text-base font-semibold text-[var(--pc-text)]">Avant d'importer</h3>
        <p className="text-sm text-[var(--pc-muted)]" data-testid="preview-summary">
          {plural(summary.total, 'ligne lue', 'lignes lues')} · {plural(summary.ready, 'prête', 'prêtes')}
          {summary.errors > 0 && <> · {plural(summary.errors, 'en erreur', 'en erreur')}</>}
          {summary.duplicates > 0 && <> · {plural(summary.duplicates, 'doublon possible', 'doublons possibles')}</>}
        </p>
      </div>

      {summary.byColumn.length > 0 && (
        <p className="text-sm text-[var(--pc-text)]" data-testid="preview-columns">
          Colonnes du suivi : {summary.byColumn.map(c => `${c.title} ${c.count}`).join(' · ')}
        </p>
      )}

      {errors.length > 0 && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200" data-testid="preview-errors">
          <p className="font-semibold flex items-center gap-1.5"><XCircle className="w-4 h-4" aria-hidden /> Lignes qui ne seront pas importées</p>
          <ul className="mt-1 space-y-0.5">
            {errors.map(i => <li key={i.line}>Ligne {i.line} : {i.error}</li>)}
          </ul>
        </section>
      )}

      {duplicates.length > 0 && (
        <section className="rounded-lg border border-[var(--pc-border)] p-3 text-sm space-y-3" data-testid="preview-duplicates">
          <p className="font-semibold flex items-center gap-1.5 text-[var(--pc-text)]"><Copy className="w-4 h-4" aria-hidden /> Doublons possibles</p>
          {duplicates.map(i => {
            const dup = i.duplicateOf!;
            const choices: DuplicateDecision[] = dup.kind === 'existing' ? ['ignore', 'merge', 'add'] : ['ignore', 'add'];
            return (
              <fieldset key={i.line}>
                <legend className="text-[var(--pc-text)]">
                  Ligne {i.line} : « {i.row!.company_name} – {i.row!.job_title} »{' '}
                  {dup.kind === 'existing'
                    ? <>existe déjà dans votre suivi{dup.date ? ` (candidature du ${dup.date})` : ''}.</>
                    : <>apparaît déjà à la ligne {dup.line} de votre tableau.</>}
                </legend>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {choices.map(d => (
                    <label key={d} className="flex items-center gap-1.5 cursor-pointer text-[var(--pc-text)]">
                      <input type="radio" name={`dup-${i.line}`} checked={i.decision === d} onChange={() => onChange(withDecision(plan, i.line, d))} />
                      {DECISION_LABELS[d]}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </section>
      )}

      {alerts.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200" data-testid="preview-alerts">
          <button type="button" onClick={() => setShowAlerts(v => !v)} className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" aria-hidden />
            {plural(summary.alerts, 'point à vérifier', 'points à vérifier')}
            {showAlerts ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
          </button>
          {showAlerts && (
            <ul className="mt-1 space-y-0.5">
              {alerts.flatMap(i => i.alerts.map((a, k) => <li key={`${i.line}-${k}`}>Ligne {i.line} ({i.row!.company_name}) : {a}</li>))}
            </ul>
          )}
        </section>
      )}

      <p className="text-xs text-[var(--pc-muted)]">
        Avant l'import, une copie de vos données est enregistrée automatiquement. Juste après, vous pourrez annuler l'import en un clic.
      </p>

      <div className="flex justify-end gap-2">
        <button type="button" className="pc-btn-secondary" onClick={onBack} disabled={busy}>Retour</button>
        <button type="button" className="pc-btn-primary" onClick={onConfirm} disabled={busy || summary.ready === 0} data-testid="preview-confirm">
          {busy ? 'Import…' : `Importer ${plural(summary.ready, 'candidature', 'candidatures')}`}
        </button>
      </div>
    </div>
  );
}
