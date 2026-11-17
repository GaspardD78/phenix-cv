import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';
import { usePromptStore } from '@/stores/promptStore';
import { useProfileStore } from '@/stores/profileStore';
import { useCvStore } from '@/stores/cvStore';
import { PROMPT_TEMPLATES, generateFullCVMatchPrompt } from '@/lib/prompt-templates';
import { analyzeAiCvJson } from '@/lib/ai-cv-pipeline';
import { AiCvGuardReport } from './AiCvGuardReport';
import { useCvTarget } from '@/hooks/useCvTarget';
import { TargetPanel } from './TargetPanel';
import { TargetStatusLine } from './TargetStatusLine';
import { SuggestedEntriesReview } from './SuggestedEntriesReview';
import { IntentPanel } from './IntentPanel';
import { ASSERTIVENESS_LABELS, candidateAnswersText, intentToTarget, withCvIntent, type CvIntent } from '@/lib/cv-intent';
import { intentToResume, type AiStartTab } from '@/lib/new-cv';
import { AiSiteLinks } from '@/components/shared/AiSiteLinks';
import { currentAiStep, stepButtonClass } from '@/lib/ai-step-buttons';
import { buildGenericCvPrompt } from '@/lib/cv-generic-prompt';
import {
  buildFollowUpPrompt, collectFollowUps, followUpSourceText, readFollowUpAnswers, toSchemaJson, withFollowUpAnswers, type FollowUpAnswers,
} from '@/lib/ai-cv-followup';
import { AiFollowUpPanel } from './AiFollowUpPanel';
import { appendEntriesToCv, promoteSuggestedEntries } from '@/lib/suggested-entries';
import type { ResolvedTarget } from '@/lib/cv-targets';
import { readCvLanguage } from '@/lib/cv-language';
import { applyAiCvToBlocks } from '@/lib/apply-ai-cv';
import { isPhotoShown } from '@/lib/cv-photo';
import { CVBlock, CVDocument } from '@/types/cv';
import { toast } from 'sonner';
import { HelpButton } from '@/components/help/HelpButton';

interface AIPromptPanelProps {
  cvId: string;
  onClose: () => void;
  /**
   * Onglet d'ouverture. `intent-ai` : reprise du parcours IA du CV standard avec les réponses
   * enregistrées dans le CV (guide de démarrage, bouton « Rédiger avec l'IA »).
   */
  initialTab?: AiStartTab;
}

export function AIPromptPanel({ onClose, initialTab = 'intent' }: AIPromptPanelProps) {
  const { profile, entries } = useProfileStore();
  const { currentCv, currentCvBlocks } = useCvStore();
  const {
    jobOffer, setJobOffer,
    selectedTemplateId, selectTemplate,
    generatedPrompt, generatePrompt,
    loadDifferentiator,
    isLoaded,
    targetPages, loadTargetPages,
    personalRules, personalRulesProfileId, loadPersonalRules,
    loadBulletFocus,
  } = usePromptStore();
  // Ciblage (tout en « Auto » au départ) ; orientation : réglage du CV > profil > défaut de la fiche > « missions ».
  const {
    choice, setChoice, dirty, markCopied, verbTense, detected, target, sheetOverrides, focus, focusFor, proposalFor, applyProposal, expandSignal, requestEdit,
  } = useCvTarget({ profileId: profile?.id, jobOfferText: jobOffer, company: currentCv?.targetCompany, cvSettings: currentCv?.settings });

  const savePages = (pages: 1 | 2) => usePromptStore.getState().saveTargetPages(pages);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [contactName, setContactName] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'intent' | 'standard' | 'full'>(initialTab === 'intent-ai' ? 'intent' : initialTab);
  // Questionnaire ouvert depuis « Adapter à une offre » par le lien sans IA.
  const [intentFromOffer, setIntentFromOffer] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [fullPromptCopied, setFullPromptCopied] = useState(false);
  const [clarify, setClarify] = useState(false);
  // CV standard confié à une IA : réponses au questionnaire (prompt « coach de carrière », sans annonce).
  const [genericIntent, setGenericIntent] = useState<CvIntent | null>(null);
  // Seconde passe : réponses aux remarques (enregistrées dans le CV, source pour le garde-fou).
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpAnswers, setFollowUpAnswers] = useState<FollowUpAnswers>(() => readFollowUpAnswers(currentCv?.settings));

  useEffect(() => {
    if (!isLoaded) loadDifferentiator();
    loadTargetPages();
  }, [isLoaded, loadDifferentiator, loadTargetPages]);

  useEffect(() => {
    if (profile) { loadPersonalRules(profile.id); loadBulletFocus(profile.id); }
  }, [profile?.id, loadPersonalRules, loadBulletFocus]);

  // Photo réellement affichée sur ce CV (photo du profil ET interrupteur « Afficher la photo »).
  const photoShown = isPhotoShown(profile, currentCv?.settings);
  // Réponses du candidat : source au même titre que le profil pour le garde-fou (CV standard seulement).
  const candidateAnswers = [genericIntent ? candidateAnswersText(genericIntent) : '', followUpSourceText(followUpAnswers)]
    .filter(Boolean).join('\n') || undefined;

  // Parse + garde-fou du JSON collé (rapport affiché avant l'application).
  const analysis = useMemo(
    () => (jsonInput.trim() ? analyzeAiCvJson(jsonInput, { entries, profile, pageBudget: targetPages, focus, verbTense, target, photoShown, candidateAnswers }) : null),
    [jsonInput, entries, profile, targetPages, focus, verbTense, target, photoShown, candidateAnswers],
  );
  const hasBlockingIssues = analysis !== null && analysis.ok && analysis.report.errors.length > 0;
  const followUpCount = useMemo(() => (analysis && analysis.ok ? collectFollowUps(analysis.report).length : 0), [analysis]);

  /** Seconde passe : même garde-fou, avec en plus les réponses en cours comme source. */
  const analyzeSecondPass = useCallback((raw: string, answers: FollowUpAnswers) => analyzeAiCvJson(raw, {
    entries, profile, pageBudget: targetPages, focus, verbTense, target, photoShown,
    candidateAnswers: [genericIntent ? candidateAnswersText(genericIntent) : '', followUpSourceText(answers)].filter(Boolean).join('\n') || undefined,
  }), [entries, profile, targetPages, focus, verbTense, target, photoShown, genericIntent]);

  /** Réponses enregistrées avec ce CV (une seule écriture, réglages les plus récents). */
  const saveFollowUpAnswers = useCallback((answers: FollowUpAnswers) => {
    setFollowUpAnswers(answers);
    const cv = useCvStore.getState().currentCv;
    if (cv) void useCvStore.getState().updateCv(cv.id, { settings: withFollowUpAnswers(cv.settings, answers) });
  }, []);

  // Entrées suggérées hors profil maître : revue opt-in (rien n'est écrit pour une entrée non cochée).
  const suggestions = useMemo(() => (analysis && analysis.ok ? analysis.data.suggestedEntries : []), [analysis]);
  const [acceptedSug, setAcceptedSug] = useState<Set<number>>(new Set());
  useEffect(() => { setAcceptedSug(new Set()); }, [jsonInput]);
  const toggleSuggestion = (idx: number) => setAcceptedSug(prev => {
    const next = new Set(prev);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    return next;
  });

  const selectedTemplate = PROMPT_TEMPLATES.find(t => t.id === selectedTemplateId);

  // Entry ref blocks visible in the current CV (for "reformulate experience" selector)
  const visibleEntryBlocks = currentCvBlocks.filter(
    b => b.isVisible && b.blockType === 'entry_ref' && b.entryId
  );

  const getBlockLabel = (block: CVBlock): string => {
    const entry = entries.find(e => e.id === block.entryId);
    if (!entry) return '(entrée inconnue)';
    const data = { ...entry, ...block.overrideData };
    const title = (data.title as string) || entry.title;
    const subtitle = (data.subtitle as string) || entry.subtitle;
    return subtitle ? `${title} — ${subtitle}` : title;
  };

  const handleGenerate = () => {
    setError('');
    if (!jobOffer.trim()) {
      setError('Collez d\'abord le texte de l\'annonce');
      return;
    }
    if (!profile || !currentCv) return;

    let targetBlock: CVBlock | undefined;
    if (selectedTemplate?.requiresBlock) {
      if (!selectedBlockId) {
        setError('Sélectionnez un bloc à reformuler');
        return;
      }
      targetBlock = currentCvBlocks.find(b => b.id === selectedBlockId);
    }

    generatePrompt({
      profile,
      cv: currentCv,
      blocks: currentCvBlocks,
      entries,
      targetBlock,
      contactName: contactName || undefined,
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  };

  // Sans annonce (candidature spontanée, recommandation), la cible décrite remplace le texte de l'annonce.
  const hasOfferField = (t: ResolvedTarget): boolean => t.intent !== 'spontanee' && t.intent !== 'recommandation';
  const offerFieldShown = hasOfferField(target);

  const buildFullPrompt = (t: ResolvedTarget): string =>
    generateFullCVMatchPrompt(profile!, entries, hasOfferField(t) ? jobOffer : '', undefined, undefined, clarify, {
      pageBudget: targetPages,
      personalRules: personalRulesProfileId === profile!.id ? personalRules : '',
      bulletFocus: focusFor(t),
      verbTense,
      cvLanguage: readCvLanguage(currentCv?.settings),
      target: t,
    });

  const handleCopyFullPrompt = async (t: ResolvedTarget = target) => {
    if (genericIntent) {
      await copyPrompt(() => buildGenericCvPrompt({
        profile: profile!, entries, intent: genericIntent, clarify,
        options: {
          personalRules: personalRulesProfileId === profile!.id ? personalRules : '',
          bulletFocus: focusFor(t),
          verbTense,
        },
      }));
      return;
    }
    if (t.intent === 'annonce' && !jobOffer.trim()) {
      setError("Collez d'abord le texte de l'annonce");
      return;
    }
    if (!hasOfferField(t) && !t.brief?.company && !t.brief?.positions?.length) {
      setError('Décrivez au moins l\'entreprise ou un poste envisagé (Préciser la cible)');
      return;
    }
    await copyPrompt(() => buildFullPrompt(t));
  };

  const copyPrompt = async (build: () => string) => {
    if (!profile) return;
    try {
      const prompt = build();
      await navigator.clipboard.writeText(prompt);
      setFullPromptCopied(true);
      markCopied();
      toast.success("Prompt copié dans le presse-papier");
      setTimeout(() => setFullPromptCopied(false), 2000);
      setError('');
    } catch {
      toast.error("Erreur lors de la copie");
    }
  };

  const handleApplyFullCV = async () => {
    if (!jsonInput.trim()) {
      toast.error("Veuillez coller le JSON généré");
      return;
    }
    if (!currentCv) return;

    const result = analyzeAiCvJson(jsonInput, { entries, profile, pageBudget: targetPages, focus, verbTense, target, photoShown, candidateAnswers });
    if (!result.ok) {
      toast.error("Erreur de parsing JSON. Vérifiez le format.");
      return;
    }
    const data = result.data;

    try {
      // Update CV metadata (only the fields the AI actually returned)
      const cvUpdates: Partial<CVDocument> = {};
      if (data.title !== undefined) cvUpdates.targetJob = data.title;
      if (data.summary !== undefined) cvUpdates.customSummary = data.summary;
      if (Object.keys(cvUpdates).length > 0) {
        await useCvStore.getState().updateCv(currentCv.id, cvUpdates);
      }

      // Apply entry-level changes (all types), skill grouping and re-ordering on
      // the CV's blocks — non destructively. The master profile is untouched.
      await applyAiCvToBlocks(currentCv.id, data, { target, sheetOverrides });

      // Suggestions acceptées : écrites dans le profil maître (opt-in explicite) puis ajoutées à ce CV.
      const accepted = data.suggestedEntries.filter((_, i) => acceptedSug.has(i));
      if (profile && accepted.length > 0) {
        await appendEntriesToCv(currentCv.id, await promoteSuggestedEntries(profile.id, accepted));
      }

      toast.success("CV sur-mesure appliqué avec succès !");
      setJsonInput('');
      onClose();
    } catch {
      toast.error("Erreur lors de l'application du CV.");
    }
  };

  /** CV standard confié à l'IA : les réponses deviennent la cible du texte préparé pour l'IA. */
  function startGenericAi(intent: CvIntent) {
    setChoice(intentToTarget(intent));
    setGenericIntent(intent);
    setIntentFromOffer(false);
    void savePages(intent.pages);
    // Une seule écriture : langue du CV et réponses (retrouvées à la réouverture, source du garde-fou).
    const cv = useCvStore.getState().currentCv;
    if (cv) void useCvStore.getState().updateCv(cv.id, { settings: withCvIntent({ ...(cv.settings ?? {}), cvLanguage: intent.language }, intent) });
    setActiveTab('full');
    toast.message('Vos réponses sont prêtes : copiez le texte pour l\'IA, puis collez sa réponse.');
  }

  // Reprise depuis le guide : une seule fois, dès que le CV et ses réponses sont chargés.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (initialTab !== 'intent-ai' || resumedRef.current || !currentCv) return;
    resumedRef.current = true;
    const saved = intentToResume(initialTab, currentCv.settings);
    if (saved) startGenericAi(saved);
    // startGenericAi lit l'état courant des stores : pas de dépendance supplémentaire.
  }, [initialTab, currentCv?.id]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-[var(--pc-card)]">
      {/* Header */}
      <div className="flex flex-col border-b border-gray-200 dark:border-[var(--pc-border)] flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[var(--pc-text)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Créer et adapter mon CV
            <HelpButton id={activeTab === 'intent' ? 'cv-standard' : 'cv-offre'} />
          </h2>
        </div>
        <div className="flex px-4 gap-4 border-t border-gray-100" role="tablist">
          {([
            ['intent', 'CV standard'],
            ['full', 'Adapter à une offre'],
            ['standard', 'Autres textes'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => { setActiveTab(id); setIntentFromOffer(false); }}
              className={`py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 dark:text-[var(--pc-muted)] hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'intent' ? (
          <IntentPanel onApplied={onClose} onUseAi={startGenericAi} fromOffer={intentFromOffer} />
        ) : activeTab === 'standard' ? (
          <>
            {/* 1. Job offer textarea */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-1">
                1. Texte de l'annonce
              </label>
              <textarea
                value={jobOffer}
                onChange={e => { setJobOffer(e.target.value); setError(''); }}
                placeholder="Collez ici le texte de l'annonce..."
                className="w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs resize-y h-28 focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
              />
            </div>

            {/* 2. Template selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-2">
                2. Objectif
              </label>
              <div className="space-y-1.5">
                {PROMPT_TEMPLATES.map(t => (
                  <label
                    key={t.id}
                    className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                      selectedTemplateId === t.id
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-gray-200 dark:border-[var(--pc-border)] hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={t.id}
                      checked={selectedTemplateId === t.id}
                      onChange={() => selectTemplate(t.id)}
                      className="mt-0.5 accent-amber-500"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-[var(--pc-text)]">{t.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-[var(--pc-muted)]">{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Conditional: block selector for "reformulate experience" */}
            {selectedTemplate?.requiresBlock && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-1">
                  Bloc à reformuler
                </label>
                <select
                  value={selectedBlockId}
                  onChange={e => setSelectedBlockId(e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs focus:ring-2 focus:ring-amber-200"
                >
                  <option value="">Sélectionnez un bloc...</option>
                  {visibleEntryBlocks.map(block => (
                    <option key={block.id} value={block.id}>
                      {getBlockLabel(block)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Conditional: contact name for "application message" */}
            {selectedTemplate?.requiresContactName && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-1">
                  Nom du contact (optionnel)
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Ex: Marie Dupont"
                  className="w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs focus:ring-2 focus:ring-amber-200"
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                {error}
              </p>
            )}

            {/* Generate button */}
            <button
              onClick={handleGenerate}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-md transition-colors shadow-sm"
            >
              Générer le prompt
            </button>

            {/* 3. Generated prompt */}
            {generatedPrompt && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-1">
                  3. Prompt généré
                </label>
                <textarea
                  readOnly
                  value={generatedPrompt}
                  className="w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs bg-gray-50 dark:bg-[var(--pc-bg)] resize-none h-64 focus:outline-none select-all cursor-text"
                  onFocus={e => e.target.select()}
                />
                <button
                  onClick={handleCopy}
                  className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    copied
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-700 dark:text-[var(--pc-text)] border border-gray-300 dark:border-[var(--pc-border)] hover:bg-gray-200'
                  }`}
                >
                  {copied ? (
                    <><Check className="w-3.5 h-3.5" /> Copié !</>
                  ) : (
                    <><Copy className="w-3.5 h-3.5" /> Copier</>
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {genericIntent ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-[var(--pc-accent-subtle)] dark:border-[var(--pc-border)] p-3 text-sm text-amber-900 dark:text-[var(--pc-text)] space-y-2" data-testid="generic-cv-banner">
                <p className="font-semibold">CV standard, sans annonce</p>
                <p>L'IA part de vos réponses (poste recherché : « {genericIntent.role} ») et reformule votre profil sans rien inventer. Niveau d'affirmation : <strong>{ASSERTIVENESS_LABELS[genericIntent.assertiveness]}</strong>.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setActiveTab('intent')}
                    className="px-2.5 py-1 text-xs rounded border border-amber-300 bg-white dark:bg-[var(--pc-card)] hover:bg-amber-100">Modifier mes réponses</button>
                  <button type="button" onClick={() => { setGenericIntent(null); setChoice({}); setJsonInput(''); }}
                    className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-[var(--pc-border)] bg-white dark:bg-[var(--pc-card)] hover:bg-gray-50">Adapter plutôt à une annonce</button>
                </div>
              </div>
            ) : (
              <TargetPanel
                choice={choice}
                onChange={c => { setChoice(c); setError(''); }}
                detected={detected}
                effectiveType={target.type}
                effectiveIntent={target.intent}
                dirty={dirty}
                onCopyPrompt={() => handleCopyFullPrompt()}
                expandSignal={expandSignal}
              />
            )}

            {offerFieldShown && !genericIntent && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-1">
                  1. Coller l'annonce
                </label>
                <textarea
                  value={jobOffer}
                  onChange={e => { setJobOffer(e.target.value); setError(''); }}
                  placeholder="Collez ici le texte de l'annonce..."
                  className="w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs resize-y h-28 focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                {error}
              </p>
            )}

            <label className="flex items-start gap-2 p-2.5 rounded-md border border-gray-200 dark:border-[var(--pc-border)] bg-gray-50 dark:bg-[var(--pc-bg)] cursor-pointer">
              <input
                type="checkbox"
                checked={clarify}
                onChange={e => setClarify(e.target.checked)}
                className="mt-0.5 accent-amber-500 flex-shrink-0"
              />
              <span className="text-xs text-gray-600 dark:text-[var(--pc-muted)] leading-relaxed">
                <span className="font-semibold text-gray-700 dark:text-[var(--pc-text)]">Affiner par questions</span> — l'IA pose 1 à 3 questions ciblées avant de générer (si besoin). Répondez-lui, puis collez sa réponse finale.
              </span>
            </label>

            <button
              onClick={() => handleCopyFullPrompt()}
              data-testid="ai-step-copy"
              className={`w-full py-2 flex items-center justify-center gap-2 text-sm font-semibold rounded-md transition-colors border ${
                stepButtonClass('copy', currentAiStep(jsonInput), { copied: fullPromptCopied })
              }`}
            >
              {fullPromptCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {fullPromptCopied ? 'Prompt copié !' : genericIntent ? '1. Copier le texte pour l\'IA' : '1. Copier le texte d\'analyse'}
            </button>

            <AiSiteLinks />

            {!genericIntent && (
              <p className="text-xs text-gray-600 dark:text-[var(--pc-muted)]" data-testid="offer-without-ai">
                Sans IA ?{' '}
                <button type="button" onClick={() => { setIntentFromOffer(true); setActiveTab('intent'); }}
                  className="font-semibold text-amber-700 dark:text-amber-400 hover:underline">
                  Composer un CV standard sans IA
                </button>
                {' '}: vous indiquez l'intitulé du poste de l'offre, et l'application choisit vos expériences.
              </p>
            )}

            <div className="pt-4 border-t border-gray-200 dark:border-[var(--pc-border)]">
              <label className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-1">
                2. Coller la réponse de l'IA ici
              </label>
              <textarea
                value={jsonInput}
                onChange={e => setJsonInput(e.target.value)}
                placeholder='{"title": "...", "summary": "...", "experiences": [...]}'
                className="w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs resize-y h-48 font-mono bg-gray-50 dark:bg-[var(--pc-bg)] focus:ring-2 focus:ring-amber-200 focus:bg-white"
              />
            </div>

            {analysis && analysis.ok && !genericIntent && (
              <TargetStatusLine
                retained={target}
                proposal={proposalFor(analysis.data.analyse?.cible)}
                onEdit={() => { setJsonInput(''); requestEdit(); toast.message('Modifiez le ciblage, puis recopiez le prompt.'); }}
                onApplyProposal={() => {
                  const outcome = proposalFor(analysis.data.analyse?.cible);
                  if (!outcome) return;
                  const next = applyProposal(outcome);
                  setJsonInput('');
                  void handleCopyFullPrompt(next);
                }}
              />
            )}
            {analysis && analysis.ok && <AiCvGuardReport report={analysis.report} onHidePhoto={() => { void useCvStore.getState().setShowPhoto(false); toast.success('La photo est masquée sur ce CV. Elle reste dans « Mon profil ».'); }} />}

            {analysis && analysis.ok && !followUpOpen && followUpCount > 0 && (
              <button type="button" onClick={() => setFollowUpOpen(true)} data-testid="ai-follow-up-open"
                className="w-full py-2 text-sm font-semibold rounded-md border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100">
                Répondre aux remarques ({followUpCount}) et faire corriger par l'IA
              </button>
            )}
            {analysis && analysis.ok && followUpOpen && profile && (
              <AiFollowUpPanel
                report={analysis.report}
                first={analysis.data}
                entries={entries}
                initialAnswers={followUpAnswers}
                buildPrompt={(questions, answers) => buildFollowUpPrompt({
                  profile, entries, current: analysis.data, questions, answers,
                  mode: genericIntent
                    ? { kind: 'generic', intent: genericIntent }
                    : { kind: 'offer', jobOfferText: hasOfferField(target) ? jobOffer : '', target },
                  options: {
                    pageBudget: targetPages,
                    personalRules: personalRulesProfileId === profile.id ? personalRules : '',
                    bulletFocus: focusFor(target),
                    verbTense,
                    cvLanguage: readCvLanguage(currentCv?.settings),
                  },
                })}
                analyze={analyzeSecondPass}
                onSaveAnswers={saveFollowUpAnswers}
                onUseVersion={merged => {
                  setJsonInput(toSchemaJson(merged));
                  setFollowUpOpen(false);
                  toast.success('Nouvelle version prête : relisez le rapport, puis appliquez au CV.');
                }}
                onClose={() => setFollowUpOpen(false)}
              />
            )}

            {!followUpOpen && <SuggestedEntriesReview suggestions={suggestions} accepted={acceptedSug} onToggle={toggleSuggestion} />}

            {!followUpOpen && <button
              onClick={handleApplyFullCV}
              data-testid="ai-step-apply"
              className={`w-full py-2.5 text-sm font-semibold rounded-md transition-colors border flex items-center justify-center gap-2 ${
                stepButtonClass('apply', currentAiStep(jsonInput), { blocking: hasBlockingIssues })
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {hasBlockingIssues ? '3. Appliquer quand même' : '3. Appliquer au CV'}
            </button>}
          </>
        )}
      </div>
    </div>
  );
}
