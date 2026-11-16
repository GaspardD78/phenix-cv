import { Fragment } from 'react';
import { Profile } from '../../types/profile';
import { CVBlock } from '../../types/cv';
import { MasterEntry } from '../../types/profile';
import { CVTemplate } from '../../types/template';
import { CVBadgeGroup } from './CVBadgeGroup';
import { buildContactItems } from './CVHeader';

type DisplayFormat = 'badges' | 'comma' | 'list' | 'columns2' | 'columns3' | 'table';

/** Badges d'une section sous un sous-en-tête de catégorie (`label` null : sans sous-en-tête). */
export interface SidebarGroup {
  label: string | null;
  blocks: CVBlock[];
}

/** A badge-type section routed into the sidebar (skills, languages, interests…). */
export interface SidebarSection {
  id: string;
  sectionName: string | null;
  /** Groupes de badges dans l'ordre d'affichage ; un sous-en-tête de catégorie ouvre un groupe. */
  groups: SidebarGroup[];
  format: DisplayFormat;
}

interface CVSidebarProps {
  profile: Profile;
  entries: MasterEntry[];
  template: CVTemplate;
  sections: SidebarSection[];
  hasPhoto: boolean;
  photoShape: string;
  photoSize: string;
  photoBorder: string;
  /**
   * `band` (défaut) : bande latérale colorée avec photo et coordonnées.
   * `column` : colonne sans fond sous l'en-tête (layout `header-columns`) ; photo et
   * coordonnées restent dans l'en-tête, les titres reprennent ceux du modèle.
   * `panel` : encadré clair à droite (layout `magazine`), même contenu que `column`
   * précédé de `lead`. `tiles` : une tuile par section (structure `badges: 'tiles'`).
   */
  variant?: 'band' | 'column' | 'panel' | 'tiles';
  /** Contenu placé en tête de l'encadré `panel` (l'accroche du modèle Magazine). */
  lead?: React.ReactNode;
}

/**
 * Colonne latérale des templates graphiques (layouts `sidebar-*`).
 * Regroupe la photo, les coordonnées et les sections « badges »
 * (compétences, langues, centres d'intérêt, certifications).
 *
 * Le contraste (texte clair sur fond coloré) est géré par les overrides CSS
 * `.cv-sidebar …` injectés depuis PrintableCV — ce composant ne fait que la
 * structure.
 */
export function CVSidebar({
  profile, entries, template, sections,
  hasPhoto, photoShape, photoSize, photoBorder, variant = 'band', lead = null,
}: CVSidebarProps) {
  const isColumn = variant !== 'band';
  const contactItems = isColumn ? [] : buildContactItems(profile);
  const headingClass = isColumn ? `${template.preview.headingClass} print:break-after-avoid` : 'cv-sidebar-heading';

  return (
    <aside className={variant === 'band' ? 'cv-sidebar' : variant === 'column' ? 'cv-side-col' : variant === 'panel' ? 'cv-side-col cv-panel' : 'cv-tiles'}>
      {lead}
      {hasPhoto && !isColumn && (() => {
        const size = photoSize || '120px';
        const shapeClass = photoShape || 'rounded-full';
        let borderClass = 'cv-sidebar-photo-ring';
        let shadowClass = '';
        if (photoBorder === 'none') borderClass = '';
        else if (photoBorder === 'thick') borderClass = 'cv-sidebar-photo-ring border-4';
        else if (photoBorder === 'shadow') { borderClass = ''; shadowClass = 'shadow-lg'; }
        return (
          <div className="flex justify-center mb-5">
            <div
              className={`${shapeClass} overflow-hidden flex-shrink-0 ${borderClass} ${shadowClass}`}
              style={{ width: size, height: size }}
            >
              <img src={profile.photoPath!} alt="Photo de profil" className="w-full h-full object-cover" />
            </div>
          </div>
        );
      })()}

      {contactItems.length > 0 && (
        <div className="cv-sidebar-section mb-5">
          <h3 className="cv-sidebar-heading">Contact</h3>
          <ul className="cv-sidebar-contact space-y-1.5">
            {contactItems.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-snug break-words">
                <span className="cv-sidebar-icon mt-px shrink-0">{item.icon}</span>
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                    {item.text}
                  </a>
                ) : (
                  <span className="break-all">{item.text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sections.map((section) => (
        <div key={section.id} className="cv-sidebar-section mb-5">
          <h3 className={headingClass}>{section.sectionName}</h3>
          {section.groups.map((group, gi) => {
            const badges = (
              <CVBadgeGroup
                blocks={group.blocks}
                entries={entries}
                template={template}
                format={section.format}
              />
            );
            // Sans sous-en-tête : même DOM qu'avant les catégories (golden inchangés).
            if (!group.label) return <Fragment key={gi}>{badges}</Fragment>;
            return (
              <div key={gi} className="cv-sidebar-group mt-2">
                <h4 className="cv-subheading cv-sidebar-subheading text-[12px] font-semibold mb-1 print:break-after-avoid">
                  {group.label}
                </h4>
                {badges}
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
