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
  /** Frise centrale (structure `alternate`) : côté du contenu par rapport à la ligne. */
  side?: 'left' | 'right';
}

export function CVEntryBlock({ block, entry, template, dateSettings = DEFAULT_DATE_SETTINGS, side = 'right' }: CVEntryBlockProps) {
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

  const description = entryData.description ? (
    <div className={`cv-desc ${template.preview.descriptionClass}`}>
      <MarkdownRenderer text={entryData.description as string} />
    </div>
  ) : null;
  const metaRow = meta ? (
    <div className="cv-meta-row">
      <span className={`cv-subtitle ${template.preview.subtitleClass}`}>{meta}</span>
    </div>
  ) : null;

  // Dates dans une marge à gauche (structure `date-gutter`) : date d'abord, puis l'intitulé,
  // dans l'ordre de lecture (le texte du PDF reste « date intitulé »).
  if (template.structure?.entry === 'date-gutter') {
    return (
      <div className={`cv-entry cv-entry-gutter ${template.preview.entryClass} print:break-inside-avoid`}>
        <div className={`cv-date cv-gutter-date ${template.preview.dateClass}`}>{dateText}</div>
        <div className="cv-gutter-body">
          <div className="cv-title-row mb-0.5">
            <span className={`cv-title ${template.preview.titleClass}`}>{entryDisplayTitle(entry, block.overrideData)}</span>
          </div>
          {metaRow}
          {description}
        </div>
      </div>
    );
  }

  const entryStyle = template.structure?.entry;
  const titleText = entryDisplayTitle(entry, block.overrideData);

  // Une ligne : « Intitulé, Entreprise · Lieu » à gauche, dates à droite (structure `inline`).
  if (entryStyle === 'inline') {
    return (
      <div className={`cv-entry cv-entry-inline ${template.preview.entryClass} print:break-inside-avoid`}>
        <div className="cv-title-row flex justify-between items-baseline mb-0.5">
          <span className="cv-title-wrap">
            <span className={`cv-title ${template.preview.titleClass}`}>{titleText}</span>
            {meta && <span className={`cv-subtitle cv-inline-meta ${template.preview.subtitleClass}`}>{`, ${meta}`}</span>}
          </span>
          {dateText && <span className={`cv-date ${template.preview.dateClass}`}>{dateText}</span>}
        </div>
        {description}
      </div>
    );
  }

  // Dates sur la ligne de l'entreprise (`date-below`), ou intitulé en saillie et le reste
  // en retrait dessous (`hanging`) : « Entreprise · Lieu · dates ».
  if (entryStyle === 'date-below' || entryStyle === 'hanging') {
    const details = (meta || dateText) ? (
      <div className="cv-meta-row">
        {meta && <span className={`cv-subtitle ${template.preview.subtitleClass}`}>{meta}</span>}
        {meta && dateText && <span className={`cv-meta-sep ${template.preview.subtitleClass}`}>{' · '}</span>}
        {dateText && <span className={`cv-date ${template.preview.dateClass}`}>{dateText}</span>}
      </div>
    ) : null;
    const hanging = entryStyle === 'hanging';
    return (
      <div className={`cv-entry ${hanging ? 'cv-entry-hanging' : 'cv-entry-date-below'} ${template.preview.entryClass} print:break-inside-avoid`}>
        <div className="cv-title-row mb-0.5">
          <span className={`cv-title ${template.preview.titleClass}`}>{titleText}</span>
        </div>
        {hanging
          ? <div className="cv-hanging-body">{details}{description}</div>
          : <>{details}{description}</>}
      </div>
    );
  }

  // Dates au-dessus de l'intitulé (`date-above`).
  if (entryStyle === 'date-above') {
    return (
      <div className={`cv-entry cv-entry-date-above ${template.preview.entryClass} print:break-inside-avoid`}>
        {dateText && <div className={`cv-date ${template.preview.dateClass}`}>{dateText}</div>}
        <div className="cv-title-row mb-0.5">
          <span className={`cv-title ${template.preview.titleClass}`}>{titleText}</span>
        </div>
        {metaRow}
        {description}
      </div>
    );
  }

  // Frise centrale (`alternate`) : dates, pastille sur la ligne, puis contenu ; le côté
  // alterne (CSS de grille), l'ordre de lecture reste « dates, intitulé, détails ».
  if (entryStyle === 'alternate') {
    return (
      <div className={`cv-entry cv-entry-alt cv-alt-${side} ${template.preview.entryClass} print:break-inside-avoid`}>
        <div className="cv-alt-date">{dateText && <span className={`cv-date ${template.preview.dateClass}`}>{dateText}</span>}</div>
        <div className="cv-alt-node" aria-hidden="true" />
        <div className="cv-alt-body">
          <div className="cv-title-row mb-0.5">
            <span className={`cv-title ${template.preview.titleClass}`}>{titleText}</span>
          </div>
          {metaRow}
          {description}
        </div>
      </div>
    );
  }

  const timeline = entryStyle === 'timeline' ? ' cv-entry-timeline'
    : entryStyle === 'card' ? ' cv-entry-card'
    : entryStyle === 'pill' ? ' cv-entry-pill' : '';

  return (
    <div className={`cv-entry${timeline} ${template.preview.entryClass} print:break-inside-avoid`}>
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
