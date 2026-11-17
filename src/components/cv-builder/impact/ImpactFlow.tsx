import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, Search } from 'lucide-react';
import type { MasterEntry, Profile } from '@/types/profile';
import { AiSiteLinks } from '@/components/shared/AiSiteLinks';
import { HelpButton } from '@/components/help/HelpButton';
import { buildResearchPrompt, personalValues } from '@/lib/target-brief-prompt';
import { NO_RESEARCH_MESSAGE, parseTargetBriefText, type BriefReport, type TargetBrief } from '@/lib/target-brief';
import { deleteBrief, loadBrief, saveBrief } from '@/lib/target-brief-repo';
import { answersText, buildGapPrompt, gapQuestions, parseGapAnalysis, NO_GAP_FOUND, type GapAnalysis } from '@/lib/cv-impact';
import type { CvIntent } from '@/lib/cv-intent';
import {
  IMPACT_STEP_LABELS, RESEARCH_FAILED_TITLE, RESEARCH_NEW_CONVERSATION, RESEARCH_PRIVACY_NOTE, SKIP_RESEARCH_HINT, defaultRole, stageAfterGap,
  type ImpactStage,
} from '@/lib/impact-flow';
import { BriefView } from './BriefView';
import { GapQuestionsPanel } from './GapQuestionsPanel';

/** Ce que le parcours fournit au texte de rédaction et au contrôle. */
export interface ImpactState {
  brief: TargetBrief;
  gap?: GapAnalysis;
  /** Réponses de la personne aux questions d'écart, déjà mises en forme. */
  answers: string;
}

interface ImpactFlowProps {
  profile: Profile;
  entries: MasterEntry[];
  /** CV standard : réponses du candidat (sinon : adapter à une offre). */
  intent: CvIntent | null;
  offerText: string;
  company?: string | null;
  targetJob?: string | null;
  /** Réponses enregistrées avec le CV (questions d'écart comprises). */
  answers: Readonly<Record<string, string>>;
  onAnswer: (key: string, value: string) => void;
  onChange: (state: ImpactState | null) => void;
  /** Étape en cours (le panneau signale qu'un texte de rédaction copié trop tôt ne contient pas la fiche). */
  onStage?: (stage: ImpactStage) => void;
}

const field = 'w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs bg-white dark:bg-[var(--pc-card)] focus:ring-2 focus:ring-amber-200 focus:border-amber-400';

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); toast.success('Texte copié : collez-le dans votre IA.'); return true; } catch { toast.error('La copie a échoué. Sélectionnez le texte et copiez-le à la main.'); return false; }
}

/**
 * « Ce que le marché attend » puis « votre profil face au marché » : trois étapes facultatives qui
 * s'ajoutent au parcours IA. L'application n'envoie rien : chaque étape est un texte à copier dans l'IA de la
 * personne, dont la réponse est recollée, contrôlée, puis montrée avant d'être utilisée.
 */
export function ImpactFlow({ profile, entries, intent, offerText, company, targetJob, answers, onAnswer, onChange, onStage }: ImpactFlowProps) {
  const [stage, setStage] = useState<ImpactStage>('research');
  const [role, setRole] = useState(() => defaultRole({ intentRole: intent?.role, targetJob, offerText, profileTitle: profile.title }));
  // Tant que la personne n'a pas écrit elle-même le métier, il suit l'offre collée.
  const roleTouched = useRef(false);
  useEffect(() => {
    if (!roleTouched.current) setRole(defaultRole({ intentRole: intent?.role, targetJob, offerText, profileTitle: profile.title }));
  }, [offerText, intent?.role, targetJob, profile.title]);
  const [sector, setSector] = useState(intent?.sector ?? '');
  const [companyName, setCompanyName] = useState(company ?? '');
  const [pasteR, setPasteR] = useState('');
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const [brief, setBrief] = useState<TargetBrief | null>(null);
  const [report, setReport] = useState<BriefReport | null>(null);
  const [cached, setCached] = useState<TargetBrief | null>(null);
  const [pasteW1, setPasteW1] = useState('');
  const [gap, setGap] = useState<GapAnalysis | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const query = useMemo(() => ({ role: role.trim(), sector: sector.trim(), company: companyName.trim() }), [role, sector, companyName]);
  const hasOffer = !intent && offerText.trim().length > 0;

  // Fiche déjà préparée pour ce métier : proposée (jamais utilisée sans clic).
  useEffect(() => {
    if (stage !== 'research' || !query.role) { setCached(null); return; }
    let live = true;
    const timer = setTimeout(() => { void loadBrief(profile.id, query).then(b => { if (live) setCached(b); }).catch(() => { if (live) setCached(null); }); }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [stage, query, profile.id]);

  const questions = useMemo(() => (gap ? gapQuestions(gap) : []), [gap]);
  useEffect(() => { onStage?.(stage); }, [stage, onStage]);

  // Ce que le parcours fournit à la rédaction : seulement une fois prêt.
  useEffect(() => {
    onChange(stage === 'ready' && brief ? { brief, ...(gap ? { gap } : {}), answers: answersText(questions, answers) } : null);
  }, [stage, brief, gap, questions, answers, onChange]);

  const researchText = () => buildResearchPrompt(
    { role: query.role, sector: query.sector, company: query.company, offerText: hasOffer ? offerText : '', language: intent?.language ?? 'fr' },
    { redact: personalValues(profile) },
  );

  const readResearch = () => {
    const r = parseTargetBriefText(pasteR);
    if (!r.ok) { setError(r.message); setFailed(null); return; }
    setError('');
    if (!r.report.usable) { setFailed(r.report.reason ?? ''); setReport(r.report); return; }
    setFailed(null); setBrief(r.brief); setReport(r.report); setStage('brief');
  };

  const useBrief = async () => {
    if (!brief) return;
    try { await saveBrief(profile.id, query, brief); } catch { /* le cache est facultatif */ }
    setStage('gap');
  };

  const refresh = async () => {
    try { await deleteBrief(profile.id, query); } catch { /* idem */ }
    setBrief(null); setReport(null); setPasteR(''); setGap(null); setPasteW1(''); setStage('research');
  };

  const gapText = () => (brief ? buildGapPrompt({ profile, entries, brief, intent: intent ?? undefined, offerText: hasOffer ? offerText : '', targetCompany: query.company || undefined }) : '');

  const readGap = () => {
    if (!brief) return;
    const r = parseGapAnalysis(pasteW1, entries, brief);
    if (!r.ok) { setError(r.message); return; }
    setError(''); setGap(r.gap); setNotes(r.notes); setStage(stageAfterGap(r.gap));
  };

  if (stage === 'skipped') {
    return (
      <div className="text-xs text-gray-600 dark:text-[var(--pc-muted)] flex items-center gap-2" data-testid="impact-skipped">
        <span>{SKIP_RESEARCH_HINT}</span>
        <button type="button" onClick={() => setStage('research')} className="font-semibold text-amber-700 hover:underline">Étudier le marché quand même</button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/40 dark:bg-[var(--pc-accent-subtle)] dark:border-[var(--pc-border)] p-3 space-y-3" data-testid="impact-flow" data-stage={stage}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{IMPACT_STEP_LABELS[stage as Exclude<ImpactStage, 'skipped'>]}</p>

      {stage === 'research' && (
        <div className="space-y-3" data-testid="impact-research">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5"><Search className="w-4 h-4" aria-hidden /> Ce que le marché attend <HelpButton id="marche-attend" /></h3>
            <p className="text-xs text-gray-600 mt-0.5">Votre IA cherche sur internet l'intitulé, les compétences et les mots du métier. Votre CV est ensuite rédigé avec ces mots, sans rien inventer sur vous.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-xs sm:col-span-3">Métier visé
              <input value={role} onChange={e => { roleTouched.current = true; setRole(e.target.value); }} className={field} placeholder="Par exemple : Assistante ADV" data-testid="impact-role" />
            </label>
            <label className="text-xs sm:col-span-2">Secteur (facultatif)
              <input value={sector} onChange={e => setSector(e.target.value)} className={field} placeholder="Par exemple : industrie" />
            </label>
            <label className="text-xs">Entreprise (facultatif)
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} className={field} />
            </label>
          </div>
          {cached && (
            <div className="rounded-md border border-green-300 bg-green-50 p-2 text-xs flex items-center gap-2" data-testid="impact-cached">
              <span className="flex-1">Une fiche existe déjà pour ce métier (du {cached.researchedAt.split('-').reverse().join('/')}).</span>
              <button type="button" className="pc-btn-secondary" onClick={() => { setBrief(cached); setReport(null); setStage('brief'); }}>Utiliser cette fiche</button>
            </div>
          )}
          <button type="button" disabled={!query.role} onClick={() => void copy(researchText())} className="pc-btn-primary w-full justify-center" data-testid="impact-copy-research">
            <Copy className="w-4 h-4" aria-hidden /> 1. Copier le texte de recherche
          </button>
          <p className="text-[11px] text-gray-600 -mt-1">{RESEARCH_PRIVACY_NOTE} {RESEARCH_NEW_CONVERSATION}</p>
          <AiSiteLinks />
          <label className="block text-xs font-semibold">2. Collez la réponse de l'IA
            <textarea value={pasteR} onChange={e => { setPasteR(e.target.value); setError(''); setFailed(null); }} rows={5} className={`${field} font-mono mt-1`} placeholder='{"schemaVersion": 1, …}' />
          </label>
          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}
          {failed !== null && (
            <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-md p-2 space-y-1.5" data-testid="impact-failed">
              <p className="font-semibold">{RESEARCH_FAILED_TITLE}</p>
              {failed.replace(NO_RESEARCH_MESSAGE, '').trim() && <p>{failed.replace(NO_RESEARCH_MESSAGE, '').trim().replace(/^\(|\)$/g, '')}</p>}
              <div className="flex gap-2">
                <button type="button" className="pc-btn-secondary" onClick={() => { setPasteR(''); setFailed(null); }}>Relancer</button>
                <button type="button" className="pc-btn-secondary" onClick={() => setStage('skipped')}>Continuer sans</button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className={pasteR.trim() ? 'pc-btn-primary flex-1 justify-center' : 'pc-btn-secondary flex-1 justify-center'} onClick={readResearch} disabled={!pasteR.trim()} data-testid="impact-read-research">Lire la réponse</button>
            <button type="button" className="pc-btn-secondary flex-1 justify-center" onClick={() => setStage('skipped')} data-testid="impact-skip">Passer la recherche</button>
          </div>
          <p className="text-[11px] text-gray-500">{SKIP_RESEARCH_HINT}</p>
        </div>
      )}

      {stage === 'brief' && brief && (
        <div className="space-y-3">
          <BriefView brief={brief} report={report} onChange={setBrief} onRefresh={() => void refresh()} />
          <div className="flex gap-2">
            <button type="button" className="pc-btn-primary flex-1 justify-center" onClick={() => void useBrief()} data-testid="impact-use-brief">Lancer l'analyse de mon profil</button>
            <button type="button" className="pc-btn-secondary" onClick={() => setStage('skipped')}>Passer</button>
          </div>
        </div>
      )}

      {stage === 'gap' && brief && (
        <div className="space-y-3" data-testid="impact-gap">
          <div>
            <h3 className="text-sm font-bold">Votre profil face au marché</h3>
            <p className="text-xs text-gray-600 mt-0.5">L'IA compare votre profil à la fiche : ce qui est déjà bon, ce qui se dit autrement dans votre métier, ce qui manque. Elle ne rédige pas encore le CV.</p>
          </div>
          <button type="button" onClick={() => void copy(gapText())} className="pc-btn-primary w-full justify-center" data-testid="impact-copy-gap"><Copy className="w-4 h-4" aria-hidden /> 1. Copier le texte d'analyse</button>
          <AiSiteLinks />
          <label className="block text-xs font-semibold">2. Collez la réponse de l'IA
            <textarea value={pasteW1} onChange={e => { setPasteW1(e.target.value); setError(''); }} rows={5} className={`${field} font-mono mt-1`} placeholder='{"alignes": […], "ecartsReels": […]}' />
          </label>
          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className={pasteW1.trim() ? 'pc-btn-primary flex-1 justify-center' : 'pc-btn-secondary flex-1 justify-center'} onClick={readGap} disabled={!pasteW1.trim()} data-testid="impact-read-gap">Lire l'analyse</button>
            <button type="button" className="pc-btn-secondary flex-1 justify-center" onClick={() => { setGap(null); setStage('ready'); }}>Passer l'analyse</button>
          </div>
          <button type="button" className="text-xs text-gray-600 hover:underline" onClick={() => setStage('brief')}>Retour à la fiche</button>
        </div>
      )}

      {stage === 'questions' && (
        <div className="space-y-3">
          {notes.length > 0 && <ul className="text-[11px] text-gray-600 list-disc ml-4">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
          <GapQuestionsPanel questions={questions} answers={answers} onAnswer={onAnswer} onDone={() => setStage('ready')} />
        </div>
      )}

      {stage === 'ready' && brief && (
        <div className="space-y-2 text-xs" data-testid="impact-ready">
          <p className="flex items-start gap-1.5 text-green-800"><Check className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden />
            <span>Fiche du {brief.researchedAt.split('-').reverse().join('/')} prête{gap ? `, analyse de votre profil lue (${gap.aligned.length} atout${gap.aligned.length > 1 ? 's' : ''} aligné${gap.aligned.length > 1 ? 's' : ''}, ${gap.toReword.length} reformulation${gap.toReword.length > 1 ? 's' : ''})` : ''}.
              {gap && questions.length === 0 ? ` ${NO_GAP_FOUND}` : ''}
            </span>
          </p>
          <p>Copiez maintenant le texte de rédaction ci-dessous : il contient la fiche et l'analyse. Le CV sera contrôlé avec la même exigence : un mot du marché que votre profil ne montre pas sera signalé.</p>
          <div className="flex gap-3">
            <button type="button" className="text-amber-700 hover:underline" onClick={() => setStage('brief')}>Modifier la fiche</button>
            <button type="button" className="text-amber-700 hover:underline" onClick={() => { setGap(null); setPasteW1(''); setStage('gap'); }}>Refaire l'analyse</button>
          </div>
        </div>
      )}
    </div>
  );
}
