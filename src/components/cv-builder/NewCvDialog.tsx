import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, FileText, Sparkles } from 'lucide-react';
import { useCvStore } from '@/stores/cvStore';
import { useProfileStore } from '@/stores/profileStore';
import { DEFAULT_NEW_CV_MODE, NEW_CV_MODES, NEW_CV_MODE_INFO, newCvRecord, suggestCvName, type NewCvMode } from '@/lib/new-cv';

/**
 * « Nouveau CV » : on choisit d'abord le parcours (« CV standard » par défaut, ou « Adapter à une offre »),
 * puis le nom ; le CV est créé et ouvert directement sur le bon parcours.
 */
export function NewCvDialog({ initialMode = DEFAULT_NEW_CV_MODE, onClose }: { initialMode?: NewCvMode; onClose: () => void }) {
  const navigate = useNavigate();
  const { createCv } = useCvStore();
  const { profile } = useProfileStore();
  const [mode, setMode] = useState<NewCvMode>(initialMode);
  const [name, setName] = useState(() => suggestCvName(initialMode, profile?.title));
  const [nameEdited, setNameEdited] = useState(false);
  const [busy, setBusy] = useState(false);

  // Le nom suivi le choix tant que la personne ne l'a pas modifié.
  useEffect(() => {
    if (!nameEdited) setName(suggestCvName(mode, profile?.title));
  }, [mode, profile?.title, nameEdited]);

  const create = async () => {
    if (!name.trim() || !profile || busy) return;
    setBusy(true);
    try {
      const id = await createCv(newCvRecord(profile.id, name));
      if (!id) throw new Error('CV non créé');
      onClose();
      navigate(`/cv/${id}?mode=${mode}`);
    } catch {
      toast.error('Impossible de créer le CV. Réessayez.');
      setBusy(false);
    }
  };

  const icons = { standard: FileText, offer: Sparkles } as const;
  return (
    <div
      role="dialog" aria-modal="true" aria-labelledby="new-cv-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4"
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
    >
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-card)] p-6 shadow-2xl text-[var(--pc-text)]">
        <h2 id="new-cv-title" className="text-lg font-bold">Nouveau CV</h2>
        <p className="text-sm text-[var(--pc-muted)] mb-4">Comment voulez-vous créer votre CV ?</p>

        <div role="radiogroup" aria-label="Parcours" className="grid gap-3">
          {NEW_CV_MODES.map(m => {
            const Icon = icons[m];
            const active = mode === m;
            return (
              <button
                key={m} type="button" role="radio" aria-checked={active}
                onClick={() => setMode(m)}
                className={`text-left rounded-xl border-2 p-4 transition-colors ${
                  active ? 'border-[var(--pc-accent)] bg-[var(--pc-accent-subtle)]' : 'border-[var(--pc-border)] hover:border-[var(--pc-border-active)]'
                }`}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Icon className="w-4 h-4 text-[var(--pc-accent)]" aria-hidden="true" />
                  {NEW_CV_MODE_INFO[m].label}
                  {m === DEFAULT_NEW_CV_MODE && <span className="text-xs font-medium rounded-full px-2 py-0.5 bg-[var(--pc-accent)] text-white">Conseillé</span>}
                  {active && <Check className="w-4 h-4 ml-auto text-[var(--pc-accent)]" aria-hidden="true" />}
                </span>
                <span className="block text-sm text-[var(--pc-muted)] mt-1">{NEW_CV_MODE_INFO[m].description}</span>
              </button>
            );
          })}
        </div>

        <label htmlFor="new-cv-name" className="block text-sm font-semibold mt-5 mb-1">Nom du CV</label>
        <input
          id="new-cv-name" autoFocus value={name}
          onChange={e => { setName(e.target.value); setNameEdited(true); }}
          onKeyDown={e => { if (e.key === 'Enter') void create(); }}
          className="w-full rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--pc-accent)]"
        />
        <p className="text-xs text-[var(--pc-muted)] mt-1">Pour le retrouver dans « Mes CV ». Vous pourrez le changer.</p>

        <div className="flex justify-end gap-2 mt-5">
          <button className="pc-btn-secondary" onClick={onClose}>Annuler</button>
          <button className="pc-btn-primary" onClick={() => void create()} disabled={busy || !name.trim() || !profile} style={{ opacity: busy || !name.trim() ? 0.5 : 1 }}>
            {busy ? 'Création…' : 'Créer et continuer'}
          </button>
        </div>
      </div>
    </div>
  );
}
