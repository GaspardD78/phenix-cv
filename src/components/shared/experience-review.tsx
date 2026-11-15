import { CheckCircle2, HelpCircle, ShieldQuestion } from 'lucide-react';
import type { ConsolidatedProposal, ExperienceSnapshot, MatchClassification } from '@/lib/experience-matching';

/**
 * Presentational pieces shared by the two experience-review screens: the
 * CV → master reconciliation modal (cv-builder) and the master-profile
 * duplicate scan modal (profile). Extracted as-is from the reconciliation
 * modal so both flows keep the exact same look and editing behaviour.
 */

export const CLASSIFICATION_BADGE: Record<MatchClassification, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  confident: { label: 'Correspondance probable', className: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
  ambiguous: { label: 'À confirmer', className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: ShieldQuestion },
  none: { label: 'Aucune correspondance nette', className: 'bg-gray-100 text-gray-600 dark:text-[var(--pc-muted)] border-gray-200 dark:border-[var(--pc-border)]', Icon: HelpCircle },
};

export function ExperiencePreview({ snapshot }: { snapshot: ExperienceSnapshot }) {
  const hasDates = !!(snapshot.datesOverrideText || snapshot.startDate || snapshot.endDate || snapshot.isCurrent);
  const datesText = snapshot.datesOverrideText
    ? snapshot.datesOverrideText
    : `${snapshot.startDate ?? '?'} — ${snapshot.isCurrent ? "aujourd'hui" : (snapshot.endDate ?? '?')}`;
  const subLine = [snapshot.subtitle, hasDates ? datesText : null].filter(Boolean).join(' · ');
  return (
    <div className="rounded-lg border border-gray-200 dark:border-[var(--pc-border)] bg-white dark:bg-[var(--pc-card)] p-3 text-sm h-full">
      <p className="font-semibold text-gray-900 dark:text-[var(--pc-text)]">{snapshot.title}</p>
      {subLine && <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mt-0.5">{subLine}</p>}
      {snapshot.description && (
        <p className="text-xs text-gray-600 dark:text-[var(--pc-muted)] mt-2 whitespace-pre-line line-clamp-6">{snapshot.description}</p>
      )}
    </div>
  );
}

export function CriterionTag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${
      ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 dark:border-[var(--pc-border)] bg-gray-50 dark:bg-[var(--pc-bg)] text-gray-400 dark:text-[var(--pc-muted)]'
    }`}>
      {label}
    </span>
  );
}

interface ProposalFormProps {
  proposal: ConsolidatedProposal;
  onChange: (proposal: ConsolidatedProposal) => void;
  /** Wording overrides for non-experience sections (duplicate scan); defaults keep the reconciliation flow untouched. */
  titlePlaceholder?: string;
  subtitlePlaceholder?: string;
  /** Hide the date fields for sections where dates are meaningless (skills, languages…). */
  showDates?: boolean;
}

/** Editable consolidated-version form — nothing is written until the user validates. */
export function ProposalForm({
  proposal,
  onChange,
  titlePlaceholder = 'Poste',
  subtitlePlaceholder = 'Entreprise',
  showDates = true,
}: ProposalFormProps) {
  const setField = <K extends keyof ConsolidatedProposal>(key: K, value: ConsolidatedProposal[K]) =>
    onChange({ ...proposal, [key]: value });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          value={proposal.title}
          onChange={e => setField('title', e.target.value)}
          placeholder={titlePlaceholder}
          className="w-full text-sm rounded-md border border-gray-300 dark:border-[var(--pc-border)] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-lagon-500"
        />
        <input
          value={proposal.subtitle ?? ''}
          onChange={e => setField('subtitle', e.target.value)}
          placeholder={subtitlePlaceholder}
          className="w-full text-sm rounded-md border border-gray-300 dark:border-[var(--pc-border)] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-lagon-500"
        />
        {showDates && (
          <>
            <input
              value={proposal.startDate ?? ''}
              onChange={e => setField('startDate', e.target.value)}
              placeholder="Début (YYYY-MM)"
              className="w-full text-sm rounded-md border border-gray-300 dark:border-[var(--pc-border)] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-lagon-500"
            />
            <input
              value={proposal.endDate ?? ''}
              onChange={e => setField('endDate', e.target.value)}
              placeholder="Fin (YYYY-MM)"
              disabled={proposal.isCurrent}
              className="w-full text-sm rounded-md border border-gray-300 dark:border-[var(--pc-border)] px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-lagon-500 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </>
        )}
      </div>
      {showDates && (
        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-[var(--pc-muted)]">
          <input type="checkbox" checked={proposal.isCurrent} onChange={e => setField('isCurrent', e.target.checked)} />
          En cours
        </label>
      )}
      <textarea
        value={proposal.description ?? ''}
        onChange={e => setField('description', e.target.value)}
        rows={5}
        placeholder="Description consolidée"
        className="w-full text-sm rounded-md border border-gray-300 dark:border-[var(--pc-border)] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-lagon-500 resize-y"
      />
    </>
  );
}
