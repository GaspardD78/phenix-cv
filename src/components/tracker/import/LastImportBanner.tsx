import { useEffect } from 'react';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { useTrackerImportStore } from '@/stores/trackerImportStore';
import type { ApplyResult } from '@/lib/tracker-import/apply';

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

async function undo() {
  try {
    const done = await useTrackerImportStore.getState().undoLastImport();
    if (done) toast.success(`Import annulé : ${plural(done.removed, 'candidature retirée', 'candidatures retirées')}${done.restored ? `, ${plural(done.restored, 'candidature remise', 'candidatures remises')} comme avant` : ''}.`);
  } catch {
    toast.error('L\'annulation n\'a pas pu aller au bout. Vos données d\'avant l\'import sont dans la sauvegarde automatique (Paramètres › Restauration).');
  }
}

/** Notification juste après un import, avec « Annuler ». */
export function notifyImportDone(result: ApplyResult) {
  const parts = [plural(result.added, 'candidature ajoutée', 'candidatures ajoutées')];
  if (result.merged) parts.push(plural(result.merged, 'complétée', 'complétées'));
  toast.success(`Import terminé : ${parts.join(', ')}.`, { action: { label: 'Annuler', onClick: () => void undo() }, duration: 15000 });
}

/** Bandeau en haut du suivi tant que le dernier import peut être annulé. */
export function LastImportBanner() {
  const { lastImport, loadLastImport, keepLastImport } = useTrackerImportStore();
  useEffect(() => { void loadLastImport(); }, [loadLastImport]);
  if (!lastImport) return null;
  const date = new Date(lastImport.at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });
  const count = lastImport.insertedIds.length + lastImport.merged.length;
  return (
    <div role="status" data-testid="last-import-banner"
      className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm border-b border-[var(--pc-border)] bg-[var(--pc-accent-subtle)] text-[var(--pc-text)]">
      <span className="flex-1 min-w-0">
        Import du {date} : {plural(lastImport.insertedIds.length, 'candidature ajoutée', 'candidatures ajoutées')}
        {lastImport.merged.length > 0 && <>, {plural(lastImport.merged.length, 'complétée', 'complétées')}</>}.
      </span>
      <button type="button" className="pc-btn-secondary" onClick={() => void undo()} disabled={count === 0}>
        <Undo2 className="w-3.5 h-3.5" aria-hidden /> Annuler cet import
      </button>
      <button type="button" className="text-xs text-[var(--pc-muted)] hover:underline" onClick={() => void keepLastImport()}>
        Garder cet import
      </button>
    </div>
  );
}
