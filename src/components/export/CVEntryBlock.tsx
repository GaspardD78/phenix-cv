import { CVBlock } from '../../types/cv';
import { MasterEntry } from '../../types/profile';
import { CVTemplate } from '../../types/template';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { DEFAULT_DATE_SETTINGS, formatEntryDates, type DateSettings } from '../../lib/entry-dates';
import { entryDisplayTitle } from '../../lib/entry-display';

interface CVEntryBlockProps {
  block: CVBlock;
  entry: MasterEntry;
  template: CVTemplate;
  /** Format des dates du CV (cv.settings, voir entry-dates.ts) ; défaut : mois et année. */
  dateSettings?: DateSettings;
}

export function CVEntryBlock({ block, entry, template, dateSettings = DEFAULT_DATE_SETTINGS }: CVEntryBlockProps) {
  const entryData = { ...entry, ...block.overrideData };

  // Non-destructive verbatim dates override (from the targeted-CV generator)
  // takes precedence over the computed start/end formatting (see entry-dates.ts).
  const dateText = formatEntryDates(
    { entryType: entry.entryType, startDate: entryData.startDate, endDate: entryData.endDate, isCurrent: entryData.isCurrent },
    (block.overrideData as Record<string, unknown> | undefined)?.datesOverride,
    dateSettings,
  );

  // Ligne 2 : entreprise (ou établissement) · lieu, en texte secondaire.
  const meta = [entryData.subtitle, entryData.location]
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`cv-entry ${template.preview.entryClass} print:break-inside-avoid`}>
      {/* Ligne 1 : intitulé à gauche, dates à droite (jamais coupées). */}
      <div className="cv-title-row flex justify-between items-baseline mb-0.5">
        <span className={`cv-title ${template.preview.titleClass}`}>{entryDisplayTitle(entry, block.overrideData)}</span>
        {dateText && (
          <span className={`cv-date ${template.preview.dateClass}`}>{dateText}</span>
        )}
      </div>
      {/* Ligne 2 : entreprise · lieu. */}
      {meta && (
        <div className="cv-meta-row">
          <span className={`cv-subtitle ${template.preview.subtitleClass}`}>{meta}</span>
        </div>
      )}
      {entryData.description && (
        <div className={`cv-desc ${template.preview.descriptionClass}`}>
          <MarkdownRenderer text={entryData.description as string} />
        </div>
      )}
    </div>
  );
}
