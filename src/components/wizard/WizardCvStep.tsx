import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntentPanel } from '@/components/cv-builder/IntentPanel';
import { Field, FIELD } from '@/components/wizard/WizardScratchForm';
import { useProfileStore } from '@/stores/profileStore';
import { useCvStore } from '@/stores/cvStore';
import { useWizardStore } from '@/stores/wizardStore';
import { newCvRecord, suggestCvName, validateCvName } from '@/lib/new-cv';

/**
 * Écran 7 : premier CV. On le nomme, il est créé comme depuis « Nouveau CV », puis le parcours
 * « CV standard » (IntentPanel) s'affiche tel quel. Appliquer la proposition valide l'étape.
 */
export function WizardCvStep() {
  const profile = useProfileStore(s => s.profile);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const createCv = useCvStore(s => s.createCv);
  const fetchCvById = useCvStore(s => s.fetchCvById);
  const currentCv = useCvStore(s => s.currentCv);
  const cvId = useWizardStore(s => s.wizard.cvId);
  const setCv = useWizardStore(s => s.setCv);
  const complete = useWizardStore(s => s.complete);
  const back = useWizardStore(s => s.back);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);
  useEffect(() => { if (!nameEdited) setName(suggestCvName('standard', profile?.title)); }, [profile?.title, nameEdited]);

  // Reprise : on recharge le CV créé par le guide ; s'il n'existe plus, on l'oublie.
  useEffect(() => {
    if (!cvId) { setChecked(true); return; }
    void (async () => {
      await fetchCvById(cvId);
      if (useCvStore.getState().currentCv?.id !== cvId) await setCv(null);
      setChecked(true);
    })();
  }, [cvId, fetchCvById, setCv]);

  const create = async () => {
    const err = validateCvName(name);
    setError(err);
    if (err || !profile || busy) return;
    setBusy(true);
    try {
      const id = await createCv(newCvRecord(profile.id, name));
      if (!id) throw new Error('CV non créé');
      await setCv(id);
      await fetchCvById(id);
    } catch {
      toast.error('Impossible de créer le CV. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(cvId && currentCv?.id === cvId);

  const footer = (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      <Button variant="outline" onClick={() => void back()}><ArrowLeft className="size-4" aria-hidden />Retour</Button>
      <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
    </div>
  );

  if (!profile || !checked) return <p className="py-10 text-center text-sm text-muted-foreground">Chargement…</p>;

  if (!ready) {
    return (
      <>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Créez votre premier CV</h1>
          <p className="text-muted-foreground">
            Votre CV part de votre profil : vous indiquez le poste visé, nous proposons une sélection de vos expériences, et vous validez.
          </p>
        </div>
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Field id="cv-name" label="Nom du CV" error={error ?? undefined}>
                <input id="cv-name" className={FIELD} value={name} onChange={e => { setName(e.target.value); setNameEdited(true); }} onKeyDown={e => { if (e.key === 'Enter') void create(); }} />
              </Field>
            </div>
            <Button className="mt-6" onClick={() => void create()} disabled={busy}>
              <FileText className="size-4" aria-hidden />{busy ? 'Création…' : 'Créer mon CV'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Ce nom n'apparaît que dans « Mes CV ». Vous pourrez le changer.</p>
        </section>
        {footer}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Créez votre premier CV</h1>
        <p className="text-muted-foreground">
          CV « {currentCv?.name} ». Répondez aux questions ci-dessous, vérifiez la proposition, puis appliquez-la à votre CV.
        </p>
      </div>
      <section className="rounded-xl border border-border bg-card p-4">
        <IntentPanel
          onApplied={() => void complete()}
          onUseAi={() => navigate(`/cv/${cvId}?mode=standard`)}
        />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void back()}><ArrowLeft className="size-4" aria-hidden />Retour</Button>
          <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
        </div>
        <Button variant="ghost" onClick={() => navigate(`/cv/${cvId}`)}>Ouvrir le CV dans l'éditeur <ArrowRight className="size-4" aria-hidden /></Button>
      </div>
    </>
  );
}
