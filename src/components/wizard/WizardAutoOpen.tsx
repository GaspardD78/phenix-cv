import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { useWizardStore } from '@/stores/wizardStore';
import { shouldAutoOpenWizard } from '@/lib/wizard/auto-open';

/**
 * Premier lancement : ouvre le guide depuis l'accueil si rien n'est enregistré et que le profil est vide.
 * L'état est enregistré aussitôt : le guide ne s'ouvrira plus seul aux lancements suivants.
 */
export function WizardAutoOpen() {
  const location = useLocation();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const startPath = location.pathname;
    void (async () => {
      try {
        await useWizardStore.getState().load();
        await useProfileStore.getState().fetchProfile();
        const { savedRaw } = useWizardStore.getState();
        const { profile, entries } = useProfileStore.getState();
        if (!shouldAutoOpenWizard(startPath, savedRaw, profile, entries)) return;
        await useWizardStore.getState().update(s => s);
        navigate('/bienvenue');
      } catch {
        // Sans état lisible, on ne force rien : le guide reste accessible depuis les Paramètres.
      }
    })();
  }, [location.pathname, navigate]);

  return null;
}
