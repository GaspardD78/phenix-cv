import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Sparkles, ArrowLeft, Wand2 } from 'lucide-react';
import { useProfileStore } from '@/stores/profileStore';
import { useCvStore } from '@/stores/cvStore';
import { applyAiCvToBlocks } from '@/lib/apply-ai-cv';
import {
  ASSERTIVENESS, ASSERTIVENESS_HINTS, ASSERTIVENESS_LABELS, DEFAULT_INTENT, HIGHLIGHTS, HIGHLIGHT_LABELS, INTENT_QUESTIONS,
  LEVELS, LEVEL_LABELS, MAX_ANSWER_CHARS, experienceBudget, proposalToResponse, proposeCv, readCvIntent, withCvIntent,
  type CvIntent, type CvProposal, type EntryPreference, type Highlight,
} from '@/lib/cv-intent';

const TYPE_LABELS: Record<string, string> = {
  experience: 'Expériences', education: 'Formations', skill: 'Compétences', certification: 'Certifications',
  language: 'Langues', project: 'Projets', volunteer: 'Bénévolat', interest: "Centres d'intérêt",
};

const label = 'block text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1';

/** Question ouverte et facultative : quelques mots ou phrases. */
function OpenQuestion({ id, n, question, hint, value, onChange }: {
  id: string; n: number; question: string; hint: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>{n}. {question} <span className="font-normal text-gray-500">(facultatif)</span></label>
      <textarea id={id} rows={2} maxLength={MAX_ANSWER_CHARS} className={`${field} resize-y`} value={value} onChange={e => onChange(e.target.value)} />
      <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mt-1">{hint}</p>
    </div>
  );
}

const field = 'w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-400 bg-white dark:bg-[var(--pc-card)]';

/**
 * « CV standard » : quelques questions, puis une proposition calculée sur votre ordinateur (sans IA).
 * Rien n'est appliqué sans votre accord ; une IA peut ensuite affiner (facultatif).
 */
export function IntentPanel({ onUseAi, onApplied }: { onUseAi: (intent: CvIntent) => void; onApplied: () => void }) {
  const { profile, entries } = useProfileStore();
  const { currentCv } = useCvStore();
  // Réponses déjà données pour ce CV (cv.settings.cvIntent), sinon le titre du profil comme poste visé.
  const [intent, setIntent] = useState<CvIntent>(() => readCvIntent(currentCv?.settings) ?? { ...DEFAULT_INTENT, role: profile?.title ?? '' });
  const [proposal, setProposal] = useState<CvProposal | null>(null);
  const [applying, setApplying] = useState(false);

  const experiences = useMemo(() => entries.filter(e => e.entryType === 'experience'), [entries]);
  const set = <K extends keyof CvIntent>(key: K, value: CvIntent[K]) => setIntent(prev => ({ ...prev, [key]: value }));

  const toggleHighlight = (h: Highlight) =>
    set('highlights', intent.highlights.includes(h) ? intent.highlights.filter(x => x !== h) : [...intent.highlights, h]);
  const setPreference = (id: string, value: EntryPreference) =>
    set('preferences', { ...intent.preferences, [id]: value });

  /** Enregistre les réponses dans le CV : retrouvées à la réouverture, et source pour le garde-fou. */
  const saveIntent = async () => {
    const cv = useCvStore.getState().currentCv;
    if (cv) await useCvStore.getState().updateCv(cv.id, { settings: withCvIntent(cv.settings, intent) });
  };

  const propose = () => {
    if (!intent.role.trim()) {
      toast.error('Indiquez d\'abord le poste que vous visez.');
      return;
    }
    void saveIntent();
    setProposal(proposeCv(intent, entries, profile, new Date()));
  };

  const toggleItem = (id: string) =>
    setProposal(p => (p ? { ...p, items: p.items.map(i => (i.id === id ? { ...i, include: !i.include } : i)) } : p));

  const apply = async () => {
    if (!proposal || !currentCv) return;
    setApplying(true);
    try {
      const data = proposalToResponse(proposal);
      if (data.title !== undefined) await useCvStore.getState().updateCv(currentCv.id, { targetJob: data.title });
      if (data.summary !== undefined) await useCvStore.getState().updateCv(currentCv.id, { customSummary: data.summary });
      await applyAiCvToBlocks(currentCv.id, data, {});
      toast.success('Votre CV a été mis à jour. Vous pouvez encore le modifier.');
      onApplied();
    } catch {
      toast.error("Impossible d'appliquer la proposition.");
    } finally {
      setApplying(false);
    }
  };

  // ── Étape 2 : proposition à relire ─────────────────────────────────────────
  if (proposal) {
    const groups = Object.keys(TYPE_LABELS)
      .map(type => ({ type, items: proposal.items.filter(i => i.type === type) }))
      .filter(g => g.items.length > 0);
    return (
      <div className="space-y-4" data-testid="intent-proposal">
        <button onClick={() => setProposal(null)} className="flex items-center gap-1 text-sm text-gray-500 dark:text-[var(--pc-muted)] hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> Modifier mes réponses
        </button>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Voici ce que nous vous proposons</h3>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">Calculé sur votre ordinateur, sans IA. Relisez, cochez ou décochez : rien n'est modifié tant que vous n'avez pas appliqué.</p>
        </div>

        <div>
          <label htmlFor="intent-title" className="block text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">Titre du CV</label>
          <input id="intent-title" className={field} value={proposal.title} onChange={e => setProposal({ ...proposal, title: e.target.value })} />
        </div>
        <div>
          <label htmlFor="intent-summary" className="block text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">Accroche</label>
          <textarea id="intent-summary" rows={3} className={`${field} resize-y`} value={proposal.summary} onChange={e => setProposal({ ...proposal, summary: e.target.value })} />
          <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mt-1">Deux ou trois lignes tournées vers le poste visé. Vérifiez les chiffres avant d'appliquer.</p>
        </div>

        <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-accent-subtle)] p-3 text-sm" data-testid="intent-years">
          <p className="font-semibold">Années calculées à partir de vos dates</p>
          <p className="mt-1">
            {proposal.experience.totalYears >= 1
              ? <>Expérience totale : <strong>{proposal.experience.totalYears} an{proposal.experience.totalYears > 1 ? 's' : ''}</strong>
                {proposal.experience.firstYear ? ` (depuis ${proposal.experience.firstYear})` : ''}.</>
              : <>Pas assez de dates pour calculer l'expérience totale.</>}
            {proposal.experience.roleYears !== null && (
              <> Dans le métier « {proposal.experience.roleLabel} » : <strong>{proposal.experience.roleYears} an{proposal.experience.roleYears > 1 ? 's' : ''}</strong>.</>
            )}
          </p>
          <p className="text-xs text-gray-600 dark:text-[var(--pc-muted)] mt-1">Les périodes qui se chevauchent comptent une fois, et les trous ne sont pas comptés. Si ce n'est pas exact, modifiez l'accroche ci-dessus.</p>
        </div>

        {proposal.notes.length > 0 && (
          <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1 text-sm text-amber-900">
            {proposal.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}

        {groups.map(g => (
          <section key={g.type}>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">{TYPE_LABELS[g.type]}</h4>
            <ul className="rounded-lg border border-gray-200 dark:border-[var(--pc-border)] divide-y divide-gray-100">
              {g.items.map(i => (
                <li key={i.id}>
                  <label className={`flex items-start gap-2 px-3 py-2 cursor-pointer ${i.include ? 'bg-white dark:bg-[var(--pc-card)]' : 'bg-gray-50 opacity-70'}`}>
                    <input type="checkbox" checked={i.include} onChange={() => toggleItem(i.id)} className="mt-1 accent-amber-500" />
                    <span className="min-w-0">
                      <span className="block text-sm text-gray-900 dark:text-[var(--pc-text)]">{i.label}</span>
                      <span className="block text-xs text-gray-500 dark:text-[var(--pc-muted)]">{i.reason}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => void apply()}
            disabled={applying}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Appliquer à mon CV
          </button>
          <button
            onClick={() => onUseAi(intent)}
            className="w-full py-2 border border-gray-300 dark:border-[var(--pc-border)] text-gray-700 dark:text-[var(--pc-text)] text-sm rounded-md hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <Wand2 className="w-4 h-4" /> Faire affiner par une IA (facultatif)
          </button>
        </div>
      </div>
    );
  }

  // ── Étape 1 : questions ────────────────────────────────────────────────────
  return (
    <div className="space-y-5" data-testid="intent-form">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Créer un CV standard</h3>
        <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">Répondez à quelques questions : nous choisissons et ordonnons le contenu de votre profil. Aucune IA n'est nécessaire. Vos réponses sont enregistrées avec ce CV.</p>
      </div>

      <div>
        <label htmlFor="intent-role" className={label}>1. {INTENT_QUESTIONS.role}</label>
        <input id="intent-role" className={field} value={intent.role} onChange={e => set('role', e.target.value)} />
      </div>
      <div>
        <label htmlFor="intent-sector" className={label}>Dans quel secteur ? <span className="font-normal text-gray-500">(facultatif)</span></label>
        <input id="intent-sector" className={field} value={intent.sector} onChange={e => set('sector', e.target.value)} />
      </div>
      <OpenQuestion id="intent-environment" n={2} question={INTENT_QUESTIONS.environment} hint="Le type de structure, d'équipe ou de rythme qui vous convient."
        value={intent.environment} onChange={v => set('environment', v)} />
      <OpenQuestion id="intent-ease" n={3} question={INTENT_QUESTIONS.ease} hint="Deux ou trois choses que vous faites bien, sans effort."
        value={intent.ease} onChange={v => set('ease', v)} />
      <OpenQuestion id="intent-achievements" n={4} question={INTENT_QUESTIONS.achievements} hint="Une à trois réalisations. Donnez un chiffre seulement s'il est exact : il pourra être repris tel quel."
        value={intent.achievements} onChange={v => set('achievements', v)} />

      <fieldset>
        <legend className={label}>5. {INTENT_QUESTIONS.highlights}</legend>
        <div className="grid gap-1.5">
          {HIGHLIGHTS.map(h => (
            <label key={h} className="flex items-center gap-2 text-sm text-gray-800 dark:text-[var(--pc-text)] cursor-pointer">
              <input type="checkbox" checked={intent.highlights.includes(h)} onChange={() => toggleHighlight(h)} className="accent-amber-500" />
              {HIGHLIGHT_LABELS[h]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="intent-level" className={label}>6. {INTENT_QUESTIONS.level}</label>
        <select id="intent-level" className={field} value={intent.level} onChange={e => set('level', e.target.value as CvIntent['level'])}>
          {LEVELS.map(l => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
      </div>

      <OpenQuestion id="intent-avoid" n={7} question={INTENT_QUESTIONS.avoid} hint="Ces missions passeront au second plan, sans cacher votre parcours."
        value={intent.avoid} onChange={v => set('avoid', v)} />

      {experiences.length > 0 && (
        <fieldset>
          <legend className="text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">Des expériences à privilégier ou à laisser de côté ?</legend>
          <ul className="rounded-lg border border-gray-200 dark:border-[var(--pc-border)] divide-y divide-gray-100">
            {experiences.map(e => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-sm text-gray-900 dark:text-[var(--pc-text)] min-w-0 truncate">{e.title}{e.subtitle ? ` (${e.subtitle})` : ''}</span>
                <select
                  aria-label={`Choix pour ${e.title}`}
                  value={intent.preferences[e.id] ?? 'normal'}
                  onChange={ev => setPreference(e.id, ev.target.value as EntryPreference)}
                  className="text-xs border border-gray-300 dark:border-[var(--pc-border)] rounded-md p-1 bg-white dark:bg-[var(--pc-card)]"
                >
                  <option value="normal">Au besoin</option>
                  <option value="prefer">Privilégier</option>
                  <option value="exclude">Laisser de côté</option>
                </select>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="intent-pages" className="block text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">Longueur</label>
          <select id="intent-pages" className={field} value={intent.pages} onChange={e => set('pages', Number(e.target.value) as 1 | 2)}>
            <option value={1}>1 page (conseillé)</option>
            <option value={2}>2 pages</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mt-1">Jusqu'à {experienceBudget(intent.pages)} expériences.</p>
        </div>
        <div>
          <label htmlFor="intent-lang" className="block text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">Langue du CV</label>
          <select id="intent-lang" className={field} value={intent.language} onChange={e => set('language', e.target.value as 'fr' | 'en')}>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
          </select>
          {intent.language === 'en' && <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mt-1">Pour traduire le contenu, utilisez ensuite l'IA (facultatif).</p>}
        </div>
      </div>

      <fieldset data-testid="intent-assertiveness">
        <legend className={label}>Niveau d'affirmation</legend>
        <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mb-1.5">Utilisé si vous faites affiner votre CV par une IA. Le ton change, jamais les faits.</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
          {ASSERTIVENESS.map(a => (
            <label key={a} className={`flex flex-col gap-0.5 rounded-md border p-2 cursor-pointer text-xs ${intent.assertiveness === a
              ? 'border-amber-400 bg-amber-50 text-amber-900 dark:bg-[var(--pc-accent-subtle)] dark:text-[var(--pc-text)]'
              : 'border-gray-300 dark:border-[var(--pc-border)] text-gray-700 dark:text-[var(--pc-muted)]'}`}>
              <span className="flex items-center gap-1.5 font-semibold text-sm">
                <input type="radio" name="intent-assertiveness" value={a} checked={intent.assertiveness === a}
                  onChange={() => set('assertiveness', a)} className="accent-amber-500" />
                {ASSERTIVENESS_LABELS[a]}
              </span>
              <span>{ASSERTIVENESS_HINTS[a]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button onClick={propose} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2">
        <Sparkles className="w-4 h-4" /> Voir ma proposition
      </button>
    </div>
  );
}
