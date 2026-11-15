import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { getSetting, setSetting } from '@/lib/db';
import {
  DEFAULT_PDF_METHOD, PDF_METHODS, PDF_METHOD_LABELS, PDF_METHOD_SETTING_KEY, formatExportLog, parsePdfMethod, type PdfExportMethod,
} from '@/lib/pdf-export-method';

/** Réglages réservés aux utilisateurs avancés, repliés par défaut. */
export function AdvancedOptions() {
  const [method, setMethod] = useState<PdfExportMethod>(DEFAULT_PDF_METHOD);

  useEffect(() => {
    void getSetting(PDF_METHOD_SETTING_KEY).then(v => setMethod(parsePdfMethod(v))).catch(() => undefined);
  }, []);

  const change = async (value: string) => {
    const next = parsePdfMethod(value);
    setMethod(next);
    try {
      await setSetting(PDF_METHOD_SETTING_KEY, next);
      toast.success('Méthode d\'export PDF enregistrée.');
    } catch {
      toast.error("Impossible d'enregistrer ce réglage.");
    }
  };

  const copyLog = async () => {
    let json: string | null = null;
    try {
      json = await invoke<string | null>('get_last_pdf_export_log');
    } catch { /* hors application */ }
    try {
      await navigator.clipboard.writeText(formatExportLog(json));
      toast.success('Détails du dernier export copiés.');
    } catch {
      toast.error('Copie impossible.');
    }
  };

  return (
    <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mt-6">
      <details className="group">
        <summary className="p-6 cursor-pointer select-none">
          <span className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Options avancées</span>
          <span className="block text-sm text-gray-500 dark:text-[var(--pc-muted)]">Réglages techniques, utiles seulement en cas de problème.</span>
        </summary>
        <div className="px-6 pb-6 space-y-3 border-t dark:border-[var(--pc-border)] pt-4">
          <label className="block text-sm font-medium dark:text-[var(--pc-text)]" htmlFor="pdf-method">Méthode d'export PDF</label>
          <select
            id="pdf-method"
            value={method}
            onChange={e => void change(e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-sm border border-gray-300 dark:border-[var(--pc-border-active)] rounded-md bg-white dark:bg-[var(--pc-bg)]"
          >
            {PDF_METHODS.map(m => <option key={m} value={m}>{PDF_METHOD_LABELS[m]}</option>)}
          </select>
          <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)]">
            En mode automatique, l'application essaie WebView2, puis Edge, puis Chrome, puis l'impression de Windows.
            Choisir une méthode précise permet de la tester : si elle échoue, l'erreur est affichée sans changer de méthode.
          </p>
          <button
            onClick={() => void copyLog()}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-[var(--pc-border-active)] hover:bg-gray-50 dark:hover:bg-[var(--pc-hover)]"
          >
            Copier les détails du dernier export
          </button>
        </div>
      </details>
    </section>
  );
}
