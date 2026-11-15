import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { ArrowLeft, ArrowRight, CheckCircle2, FileDown, FolderOpen, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PrintableCV } from '@/components/export/PrintableCV';
import { OverflowConfirmDialog } from '@/components/cv-builder/OverflowConfirmDialog';
import { TemplatePickerPopover } from '@/components/cv-builder/TemplatePickerPopover';
import { useProfileStore } from '@/stores/profileStore';
import { useCvStore } from '@/stores/cvStore';
import { useWizardStore } from '@/stores/wizardStore';
import { getTemplate } from '@/templates';
import { exportNativePdf } from '@/lib/export-pdf';
import { exportToDocx } from '@/lib/export-docx';
import type { PrintOverflow } from '@/lib/print-overflow';
import { NEXT_STEPS, nextStepRoute, savedMessage, type ExportFormat } from '@/lib/wizard/export-step';

function EndScreen({ cvId }: { cvId: string | null }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="space-y-2 text-center">
        <PartyPopper className="mx-auto size-10 text-primary" aria-hidden />
        <h1 className="text-2xl font-semibold">Bravo, votre premier CV est prêt !</h1>
        <p className="text-muted-foreground">Le guide est terminé. Voici ce que vous pouvez faire maintenant.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {NEXT_STEPS.map(step => (
          <li key={step.title}>
            <button
              type="button"
              onClick={() => navigate(nextStepRoute(step, cvId))}
              className="flex h-full w-full flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="font-semibold">{step.title}</span>
              <span className="text-sm text-muted-foreground">{step.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex justify-center border-t border-border pt-3">
        <Button onClick={() => navigate('/')}>Aller à l'accueil <ArrowRight className="size-4" aria-hidden /></Button>
      </div>
    </>
  );
}

/** Écran 8 : télécharger le premier CV en PDF ou en Word, ouvrir le dossier, puis terminer le guide. */
export function WizardExportStep() {
  const profile = useProfileStore(s => s.profile);
  const entries = useProfileStore(s => s.entries);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const currentCv = useCvStore(s => s.currentCv);
  const blocks = useCvStore(s => s.currentCvBlocks);
  const fetchCvById = useCvStore(s => s.fetchCvById);
  const fetchCvBlocks = useCvStore(s => s.fetchCvBlocks);
  const setTemplate = useCvStore(s => s.setTemplate);
  const cvId = useWizardStore(s => s.wizard.cvId);
  const finished = useWizardStore(s => s.wizard.finished);
  const finish = useWizardStore(s => s.finish);
  const back = useWizardStore(s => s.back);
  const goTo = useWizardStore(s => s.goTo);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [saved, setSaved] = useState<{ format: ExportFormat; path: string } | null>(null);
  const [overflow, setOverflow] = useState<PrintOverflow | null>(null);
  const [overflowAnswer, setOverflowAnswer] = useState<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    void fetchProfile();
    if (cvId) { void fetchCvById(cvId); void fetchCvBlocks(cvId); }
  }, [cvId, fetchProfile, fetchCvById, fetchCvBlocks]);

  if (finished) return <EndScreen cvId={cvId} />;

  const ready = Boolean(cvId && currentCv?.id === cvId && profile);

  const exportAs = async (format: ExportFormat) => {
    if (!currentCv || !profile) return;
    setBusy(format);
    const onSaved = (path: string) => setSaved({ format, path });
    try {
      if (format === 'pdf') {
        await exportNativePdf('printable-cv', {
          onSaved,
          confirmOverflow: o => new Promise<boolean>(resolve => { setOverflow(o); setOverflowAnswer(() => resolve); }),
        });
      } else {
        await exportToDocx(currentCv, profile, blocks, entries, getTemplate(currentCv.templateId), { onSaved });
      }
    } catch (e) {
      toast.error(`L'export n'a pas abouti : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const answerOverflow = (ok: boolean) => {
    overflowAnswer?.(ok);
    setOverflowAnswer(null);
    setOverflow(null);
  };

  const openFolder = async () => {
    if (!saved) return;
    try { await revealItemInDir(saved.path); } catch { toast.error('Impossible d\'ouvrir le dossier.'); }
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void back()}><ArrowLeft className="size-4" aria-hidden />Retour</Button>
        <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
      </div>
      <Button onClick={() => void finish()} variant={saved ? 'default' : 'ghost'}>
        {saved ? 'Terminer le guide' : 'Terminer sans télécharger'} <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );

  if (!cvId) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Téléchargez votre CV</h1>
        <p className="text-muted-foreground">Vous n'avez pas encore créé de CV dans le guide.</p>
        <div><Button onClick={() => void goTo('cv')}><ArrowLeft className="size-4" aria-hidden />Créer mon premier CV</Button></div>
        {footer}
      </>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Téléchargez votre CV</h1>
        <p className="text-muted-foreground">
          Le PDF est le format à envoyer aux recruteurs. Le format Word sert si l'on vous demande un fichier modifiable.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="mx-auto overflow-hidden rounded-lg border border-border bg-white shadow-sm" style={{ width: 238, height: 336 }} aria-label="Aperçu du CV">
          {ready && currentCv && profile ? (
            <div style={{ width: '210mm', transform: 'scale(0.3)', transformOrigin: 'top left' }}>
              <PrintableCV cv={currentCv} profile={profile} blocks={blocks} entries={entries} template={getTemplate(currentCv.templateId)} />
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Chargement de l'aperçu…</p>
          )}
        </div>

        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">CV « {currentCv?.name ?? '…'} »</h2>
          <div className="space-y-1">
            <p className="text-sm font-medium">1. Choisissez un modèle</p>
            {currentCv && (
              <TemplatePickerPopover currentTemplateId={currentCv.templateId} onSelect={id => void setTemplate(id).catch(() => toast.error("Le modèle n'a pas pu être enregistré."))} />
            )}
            <p className="text-xs text-muted-foreground">L'aperçu change tout de suite. Les modèles « ATS » se lisent sans difficulté par les logiciels de recrutement.</p>
          </div>
          <p className="text-sm font-medium">2. Téléchargez-le</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void exportAs('pdf')} disabled={!ready || busy !== null}>
              <FileDown className="size-4" aria-hidden />{busy === 'pdf' ? 'Export en cours…' : 'Télécharger en PDF'}
            </Button>
            <Button variant="outline" onClick={() => void exportAs('docx')} disabled={!ready || busy !== null}>
              <FileDown className="size-4" aria-hidden />{busy === 'docx' ? 'Export en cours…' : 'Télécharger en Word'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Une fenêtre vous demande où enregistrer le fichier.</p>
          {saved && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background p-3 text-sm">
              <span className="flex items-center gap-2"><CheckCircle2 className="size-4 text-primary" aria-hidden />{savedMessage(saved.format, saved.path)}</span>
              <Button variant="outline" onClick={() => void openFolder()}><FolderOpen className="size-4" aria-hidden />Ouvrir le dossier</Button>
            </div>
          )}
        </section>
      </div>

      {footer}
      <OverflowConfirmDialog overflow={overflow} onConfirm={() => answerOverflow(true)} onCancel={() => answerOverflow(false)} />
    </>
  );
}
