import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { StepSource, StepProcess, StepPreview } from '@/components/import/ImportPage';
import { useProfileStore } from '@/stores/profileStore';
import { applyImport } from '@/lib/import/apply-import';
import type { ImportFormat, ImportPayload, ProfileFieldDiff, SelectableEntry } from '@/lib/import/types';

type Sub = 'source' | 'process' | 'preview' | 'done';

/** Écran 3, chemin « J'ai déjà un CV » ou « export LinkedIn » : mêmes étapes que la page d'import. */
export function WizardImportStep({ onManual, onDone, showIntro = true }: { onManual: () => void; onDone: () => void; showIntro?: boolean }) {
  const [sub, setSub] = useState<Sub>('source');
  const [format, setFormat] = useState<ImportFormat | null>(null);
  const [rawText, setRawText] = useState<string | undefined>();
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState({ profileCount: 0, entryCount: 0 });

  const handleSource = (fmt: ImportFormat, parsed: ImportPayload | null, text?: string) => {
    setFormat(fmt);
    setRawText(text);
    if (parsed) {
      setPayload(parsed);
      setSub('preview');
    } else {
      setSub('process');
    }
  };

  const handleConfirm = async (diffs: ProfileFieldDiff[], entries: SelectableEntry[]) => {
    setSaving(true);
    const store = useProfileStore.getState();
    try {
      const r = await applyImport(diffs, entries, {
        updateProfile: store.updateProfile,
        addEntry: store.addEntry,
        fetchProfile: store.fetchProfile,
        getProfileId: () => useProfileStore.getState().profile?.id ?? '',
      });
      setResult(r);
      setSub('done');
    } catch (e) {
      toast.error(`Erreur lors de l'enregistrement : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  };

  if (sub === 'source') return <StepSource onNext={handleSource} onManual={onManual} showIntro={showIntro} />;
  if (sub === 'process' && format) {
    return (
      <StepProcess
        format={format}
        rawText={rawText}
        onNext={p => { setPayload(p); setSub('preview'); }}
        onBack={() => setSub('source')}
        onManual={onManual}
      />
    );
  }
  if (sub === 'preview' && payload) {
    return saving ? (
      <p className="py-10 text-center text-sm text-muted-foreground">Enregistrement en cours…</p>
    ) : (
      <StepPreview payload={payload} onConfirm={handleConfirm} onBack={() => setSub(format === 'linkedin' ? 'source' : 'process')} />
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-base">
        Votre profil est enregistré : {result.entryCount} entrée(s) ajoutée(s)
        {result.profileCount > 0 ? `, ${result.profileCount} information(s) mise(s) à jour` : ''}.
      </p>
      <div className="flex justify-end">
        <Button onClick={onDone}>Continuer <ArrowRight className="size-4" aria-hidden /></Button>
      </div>
    </div>
  );
}
