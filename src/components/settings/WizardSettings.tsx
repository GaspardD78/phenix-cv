import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/help/HelpButton';
import { useWizardStore } from '@/stores/wizardStore';
import { wizardProgress } from '@/lib/wizard/state';
import { wizardStatus } from '@/lib/wizard/auto-open';

/** Paramètres › Aide › Guide de démarrage : reprendre ou revoir le guide. */
export function WizardSettings() {
  const loaded = useWizardStore(s => s.loaded);
  const load = useWizardStore(s => s.load);
  const wizard = useWizardStore(s => s.wizard);
  const savedRaw = useWizardStore(s => s.savedRaw);
  const restart = useWizardStore(s => s.restart);
  const navigate = useNavigate();

  useEffect(() => { void load(); }, [load]);

  const status = wizardStatus(savedRaw, wizard.finished);
  const text = status === 'termine'
    ? 'Vous avez terminé le guide.'
    : status === 'en-cours'
      ? `Guide en cours : ${wizardProgress(wizard)} % parcouru.`
      : 'Vous n\'avez pas encore suivi le guide.';

  const relaunch = async () => {
    await restart();
    navigate('/bienvenue');
  };

  return (
    <section className="mt-6 rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border p-6">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Guide de démarrage</h2>
          <HelpButton id="guide" />
        </div>
        <p className="text-sm text-muted-foreground">
          Le guide vous accompagne de l'import de votre CV jusqu'à son export. Le relancer ne modifie ni votre profil ni vos CV.
        </p>
      </div>
      <div className="space-y-4 p-6">
        <p className="text-sm" role="status">{loaded ? text : 'Chargement…'}</p>
        <div className="flex flex-wrap gap-2">
          {status === 'en-cours' && (
            <Button onClick={() => navigate('/bienvenue')}><Compass className="size-4" aria-hidden />Reprendre le guide</Button>
          )}
          <Button variant={status === 'en-cours' ? 'outline' : 'default'} onClick={() => void relaunch()} disabled={!loaded}>
            <RotateCcw className="size-4" aria-hidden />Revoir le guide
          </Button>
        </div>
      </div>
    </section>
  );
}
