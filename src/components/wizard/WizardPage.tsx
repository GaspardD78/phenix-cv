import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FileText, Linkedin, PenLine, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/help/HelpButton';
import { useWizardStore } from '@/stores/wizardStore';
import { WIZARD_STEPS, START_PATHS, wizardProgress, type StartPath, type WizardStep } from '@/lib/wizard/state';
import { cn } from '@/lib/utils';
import { WizardImportStep } from '@/components/wizard/WizardImportStep';
import { WizardScratchForm } from '@/components/wizard/WizardScratchForm';
import { WizardVerifyStep } from '@/components/wizard/WizardVerifyStep';
import { WizardPhotoStep } from '@/components/wizard/WizardPhotoStep';
import { WizardEnrichStep } from '@/components/wizard/WizardEnrichStep';

const STEP_LABELS: Record<WizardStep, string> = {
  welcome: 'Bienvenue',
  start: 'Point de départ',
  import: 'Import ou saisie',
  verify: 'Vérification du profil',
  photo: 'Photo (facultative)',
  enrich: 'Enrichissement',
  cv: 'Premier CV',
  export: 'Export et fin',
};

const PATH_CARDS: Record<StartPath, { title: string; text: string; Icon: typeof FileText }> = {
  cv: { title: "J'ai déjà un CV", text: 'Un fichier PDF ou Word : nous en tirons votre profil.', Icon: FileText },
  linkedin: { title: "J'ai un export LinkedIn", text: 'Le fichier de données téléchargé depuis votre compte LinkedIn.', Icon: Linkedin },
  scratch: { title: 'Je pars de zéro', text: 'Pas de fichier : nous vous posons quelques questions simples.', Icon: PenLine },
};

function Progress({ value }: { value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Avancement du guide</span>
        <span>{value} %</span>
      </div>
      <div
        role="progressbar"
        aria-label="Avancement du guide"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StepList({ current }: { current: WizardStep }) {
  const { completed, skipped } = useWizardStore(s => s.wizard);
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {WIZARD_STEPS.map((step, i) => {
        const done = completed.includes(step) || skipped.includes(step);
        const isCurrent = step === current;
        return (
          <li
            key={step}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm',
              isCurrent ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card',
            )}
          >
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span>{STEP_LABELS[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

function WelcomeScreen() {
  const next = useWizardStore(s => s.complete);
  const wizard = useWizardStore(s => s.wizard);
  const navigate = useNavigate();
  return (
    <>
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Bienvenue dans Phénix CV</h1>
        <p className="text-muted-foreground">
          Ce guide vous accompagne pas à pas pour créer votre premier CV. Comptez une dizaine de minutes.
          Vous pouvez le quitter à tout moment : votre avancement est gardé.
        </p>
      </div>
      <Progress value={wizardProgress(wizard)} />
      <StepList current="welcome" />
      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
        <Button onClick={() => void next()}>
          Commencer <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </>
  );
}

function StartScreen() {
  const wizard = useWizardStore(s => s.wizard);
  const choosePath = useWizardStore(s => s.choosePath);
  const complete = useWizardStore(s => s.complete);
  const back = useWizardStore(s => s.back);
  const navigate = useNavigate();
  const selected = wizard.startPath;
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Par où voulez-vous commencer ?</h1>
        <p className="text-muted-foreground">Choisissez ce qui vous ressemble le plus. Vous pourrez changer plus tard.</p>
      </div>
      <div role="radiogroup" aria-label="Point de départ" className="grid gap-3 sm:grid-cols-3">
        {START_PATHS.map(path => {
          const { title, text, Icon } = PATH_CARDS[path];
          const isSelected = selected === path;
          return (
            <button
              key={path}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => void choosePath(path)}
              className={cn(
                'relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected ? 'border-2 border-primary' : 'border-border',
              )}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" aria-hidden />
                </span>
              )}
              <Icon className="size-6 text-primary" aria-hidden />
              <span className="font-semibold">{title}</span>
              <span className="text-sm text-muted-foreground">{text}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void back()}>
            <ArrowLeft className="size-4" aria-hidden /> Retour
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
        </div>
        <Button disabled={!selected} onClick={() => void complete()}>
          Continuer <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </>
  );
}

function ImportScreen() {
  const startPath = useWizardStore(s => s.wizard.startPath);
  const complete = useWizardStore(s => s.complete);
  const skip = useWizardStore(s => s.skip);
  const back = useWizardStore(s => s.back);
  const navigate = useNavigate();
  const [manual, setManual] = useState(startPath === 'scratch');
  const fromScratch = startPath === 'scratch';
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {manual ? 'Parlez-nous de vous' : 'Récupérons vos informations'}
        </h1>
        <p className="text-muted-foreground">
          {manual
            ? 'Quelques champs suffisent pour démarrer. Vous compléterez le reste dans Mon profil.'
            : 'Nous récupérons les informations de votre CV ou de votre export LinkedIn, et vous les vérifiez avant tout enregistrement.'}
        </p>
      </div>
      {manual ? (
        <WizardScratchForm onDone={() => void complete()} />
      ) : (
        <WizardImportStep onManual={() => setManual(true)} onDone={() => void complete()} showIntro={false} />
      )}
      <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void back()}>
            <ArrowLeft className="size-4" aria-hidden /> Retour
          </Button>
          {manual && !fromScratch && (
            <Button variant="ghost" onClick={() => setManual(false)}>Revenir au fichier</Button>
          )}
          <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
        </div>
        <Button variant="ghost" onClick={() => void skip()}>Passer cette étape</Button>
      </div>
    </>
  );
}

function PendingScreen({ step }: { step: WizardStep }) {
  const back = useWizardStore(s => s.back);
  return (
    <>
      <h1 className="text-2xl font-semibold">{STEP_LABELS[step]}</h1>
      <p className="text-muted-foreground">Cette étape arrive dans la prochaine version du guide.</p>
      <Button variant="outline" onClick={() => void back()}>
        <ArrowLeft className="size-4" aria-hidden /> Retour
      </Button>
    </>
  );
}

export function WizardPage() {
  const load = useWizardStore(s => s.load);
  const loaded = useWizardStore(s => s.loaded);
  const step = useWizardStore(s => s.wizard.step);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  if (!loaded) return null;

  let screen;
  if (step === 'welcome') screen = <WelcomeScreen />;
  else if (step === 'start') screen = <StartScreen />;
  else if (step === 'import') screen = <ImportScreen />;
  else if (step === 'verify') screen = <WizardVerifyStep />;
  else if (step === 'photo') screen = <WizardPhotoStep />;
  else if (step === 'enrich') screen = <WizardEnrichStep />;
  else screen = <PendingScreen step={step} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Guide de démarrage · étape {WIZARD_STEPS.indexOf(step) + 1} sur {WIZARD_STEPS.length}</span>
        <HelpButton id={step === 'start' ? 'guide-depart' : step === 'import' ? 'importer' : step === 'verify' ? 'profil' : step === 'photo' ? 'photo' : step === 'enrich' ? 'enrichir' : 'guide'} />
      </div>
      {screen}
    </div>
  );
}
