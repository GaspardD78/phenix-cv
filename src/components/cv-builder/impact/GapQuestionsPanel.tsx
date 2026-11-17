import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { GapQuestion } from '@/lib/cv-impact';
import { MAX_FOLLOW_UP_ANSWER_CHARS } from '@/lib/ai-cv-followup';

interface GapQuestionsPanelProps {
  questions: readonly GapQuestion[];
  answers: Readonly<Record<string, string>>;
  onAnswer: (key: string, value: string) => void;
  onDone: () => void;
}

/** Les questions d'écart, une par une, avec « Passer » : une réponse devient une source, au même titre que le profil. */
export function GapQuestionsPanel({ questions, answers, onAnswer, onDone }: GapQuestionsPanelProps) {
  const [index, setIndex] = useState(0);
  const q = questions[index];
  if (!q) return null;
  const last = index === questions.length - 1;
  const next = () => (last ? onDone() : setIndex(index + 1));
  return (
    <div className="space-y-3" data-testid="gap-question">
      <div>
        <p className="text-[11px] text-gray-500">Question {index + 1} sur {questions.length}</p>
        <p className="text-sm font-semibold mt-1">{q.text}</p>
        <p className="text-[11px] text-gray-500 mt-1">Le marché attend : {q.expectation}. Répondez seulement si c'est vrai : votre réponse sera utilisée comme votre profil. Sinon, cliquez sur « Passer ».</p>
      </div>
      <textarea value={answers[q.key] ?? ''} maxLength={MAX_FOLLOW_UP_ANSWER_CHARS} rows={3} aria-label="Votre réponse"
        onChange={e => onAnswer(q.key, e.target.value)}
        placeholder="Par exemple : où, quand et comment (outil, durée, volume)…"
        className="w-full p-2 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-xs bg-white dark:bg-[var(--pc-card)] focus:ring-2 focus:ring-amber-200" />
      <div className="flex justify-between gap-2">
        <button type="button" className="pc-btn-secondary" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}><ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Précédente</button>
        <div className="flex gap-2">
          <button type="button" className="pc-btn-secondary" onClick={() => { onAnswer(q.key, ''); next(); }} data-testid="gap-skip">Passer</button>
          <button type="button" className="pc-btn-primary" onClick={next} data-testid="gap-next">{last ? 'Terminer' : 'Suivant'} <ArrowRight className="w-3.5 h-3.5" aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
