import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Check, Copy, MessageCircleQuestion, X } from 'lucide-react';
import type { MasterEntry } from '@/types/profile';
import type { AiCvResponse } from '@/lib/ai-cv-response';
import type { GuardReport } from '@/lib/ai-cv-guard';
import type { AiCvAnalysis } from '@/lib/ai-cv-pipeline';
import {
  FOLLOW_UP_KIND_LABELS, MAX_FOLLOW_UP_ANSWER_CHARS, collectFollowUps, diffAiCv, mergeAiCv,
  type FollowUpAnswers, type FollowUpQuestion,
} from '@/lib/ai-cv-followup';
import { AiCvGuardReport } from './AiCvGuardReport';

interface AiFollowUpPanelProps {
  /** Rapport et données (déjà contrôlées) de la première version. */
  report: GuardReport;
  first: AiCvResponse;
  entries: readonly MasterEntry[];
  initialAnswers: FollowUpAnswers;
  buildPrompt: (questions: readonly FollowUpQuestion[], answers: FollowUpAnswers) => string;
  /** Même garde-fou que la première passe, avec les réponses comme source. */
  analyze: (raw: string, answers: FollowUpAnswers) => AiCvAnalysis;
  onSaveAnswers: (answers: FollowUpAnswers) => void;
  /** Version finale (première version + changements cochés), à relire puis appliquer avec le bouton habituel. */
  onUseVersion: (merged: AiCvResponse, answers: FollowUpAnswers) => void;
  onClose: () => void;
}

const field = 'w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs bg-white dark:bg-[var(--pc-card)] focus:ring-2 focus:ring-amber-200 focus:border-amber-400';

/**
 * Seconde passe : le candidat répond aux remarques, copie le texte pour l'IA, colle sa réponse, puis
 * coche un par un les changements qu'il garde. Rien n'est appliqué au CV ici.
 */
export function AiFollowUpPanel({
  report, first, entries, initialAnswers, buildPrompt, analyze, onSaveAnswers, onUseVersion, onClose,
}: AiFollowUpPanelProps) {
  const questions = useMemo(() => collectFollowUps(report), [report]);
  const [answers, setAnswers] = useState<FollowUpAnswers>(initialAnswers);
  const [copied, setCopied] = useState(false);
  const [second, setSecond] = useState('');
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const analysis = useMemo(() => (second.trim() ? analyze(second, answers) : null), [second, answers, analyze]);
  const changes = useMemo(() => (analysis?.ok ? diffAiCv(first, analysis.data, entries) : []), [analysis, first, entries]);
  const kept = changes.filter(c => !rejected.has(c.key));
  const answered = questions.filter(q => answers[q.key]?.trim()).length;

  const toggle = (key: string) => setRejected(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const copyPrompt = async () => {
    onSaveAnswers(answers);
    try {
      await navigator.clipboard.writeText(buildPrompt(questions, answers));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Texte copié : collez-le dans la même conversation avec l'IA.");
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const useVersion = () => {
    if (!analysis?.ok) return;
    onSaveAnswers(answers);
    onUseVersion(mergeAiCv(first, analysis.data, new Set(kept.map(c => c.key))), answers);
  };

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/60 dark:bg-[var(--pc-surface)] dark:border-[var(--pc-border)] p-3 space-y-3" data-testid="ai-follow-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-[var(--pc-text)]">
            <MessageCircleQuestion className="w-4 h-4 text-sky-600" /> Répondre aux remarques
          </h3>
          <p className="text-xs text-gray-600 dark:text-[var(--pc-muted)] mt-0.5">
            Vos réponses comptent comme source, comme votre profil : l'IA peut reprendre un chiffre que vous donnez. Laissez vide ce que vous ne voulez pas préciser. Vos réponses sont enregistrées avec ce CV.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 rounded text-gray-500 hover:bg-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <ol className="space-y-2.5">
        {questions.map((q, i) => (
          <li key={q.key} className="space-y-1">
            <label htmlFor={`follow-up-${i}`} className="block text-xs text-gray-800 dark:text-[var(--pc-text)]">
              <span className="mr-1.5 inline-block rounded bg-white dark:bg-[var(--pc-card)] border border-gray-200 dark:border-[var(--pc-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                {FOLLOW_UP_KIND_LABELS[q.kind]}
              </span>
              {q.text}
            </label>
            <textarea id={`follow-up-${i}`} rows={2} maxLength={MAX_FOLLOW_UP_ANSWER_CHARS} className={`${field} resize-y`}
              value={answers[q.key] ?? ''} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })} />
          </li>
        ))}
      </ol>

      <button type="button" onClick={() => { void copyPrompt(); }}
        className={`w-full py-2 flex items-center justify-center gap-2 text-sm font-semibold rounded-md border transition-colors ${
          copied ? 'bg-green-50 text-green-700 border-green-300' : 'bg-white dark:bg-[var(--pc-card)] text-gray-700 dark:text-[var(--pc-text)] border-gray-300 dark:border-[var(--pc-border)] hover:bg-gray-50'
        }`}>
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Texte copié !' : `1. Copier le texte pour l'IA (${answered} réponse${answered > 1 ? 's' : ''} sur ${questions.length})`}
      </button>

      <div>
        <label htmlFor="follow-up-response" className="block text-xs font-semibold text-gray-700 dark:text-[var(--pc-text)] mb-1">
          2. Coller la nouvelle réponse de l'IA
        </label>
        <textarea id="follow-up-response" value={second} onChange={e => { setSecond(e.target.value); setRejected(new Set()); }}
          className={`${field} font-mono h-32 resize-y`} />
        {analysis && !analysis.ok && (
          <p className="mt-1 text-xs text-red-700">Cette réponse n'est pas lisible : copiez toute la réponse de l'IA, de la première à la dernière accolade.</p>
        )}
      </div>

      {analysis?.ok && (
        <>
          <AiCvGuardReport report={analysis.report} />

          <div data-testid="ai-follow-up-changes">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-[var(--pc-text)]">3. Choisissez les changements à garder</h4>
              {changes.length > 1 && (
                <span className="flex gap-2 text-xs">
                  <button type="button" className="text-sky-700 hover:underline" onClick={() => setRejected(new Set())}>Tout cocher</button>
                  <button type="button" className="text-sky-700 hover:underline" onClick={() => setRejected(new Set(changes.map(c => c.key)))}>Tout décocher</button>
                </span>
              )}
            </div>
            {changes.length === 0 ? (
              <p className="text-xs text-gray-600 dark:text-[var(--pc-muted)]">La nouvelle réponse ne change rien à la première version.</p>
            ) : (
              <ul className="space-y-1.5">
                {changes.map(c => (
                  <li key={c.key}>
                    <label className="flex items-start gap-2 rounded-md border border-gray-200 dark:border-[var(--pc-border)] bg-white dark:bg-[var(--pc-card)] p-2 cursor-pointer">
                      <input type="checkbox" checked={!rejected.has(c.key)} onChange={() => toggle(c.key)} className="mt-0.5 accent-amber-500" />
                      <span className="min-w-0 text-xs space-y-1">
                        <span className="block font-semibold text-gray-900 dark:text-[var(--pc-text)]">{c.label}</span>
                        <span className="block whitespace-pre-line text-gray-500 line-through decoration-gray-400">{c.before}</span>
                        <span className="flex items-start gap-1 whitespace-pre-line text-gray-900 dark:text-[var(--pc-text)]">
                          <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" />{c.after}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" onClick={useVersion} disabled={changes.length > 0 && kept.length === 0}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold rounded-md">
            {changes.length === 0 ? 'Garder la première version' : `Utiliser cette version (${kept.length} changement${kept.length > 1 ? 's' : ''} sur ${changes.length})`}
          </button>
          <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)]">Rien n'est encore appliqué : vous relirez le rapport, puis cliquerez sur « Appliquer au CV ».</p>
        </>
      )}
    </section>
  );
}
