import type { MasterEntry } from '@/types/profile';
import type { AngleSpec } from '../cv-angles';
import { makeEntry } from './cv-fixtures';

/** Profil fictif avec tags d'angle (aucune donnée réelle). */
export function makeAngleEntries(): MasterEntry[] {
  return [
    makeEntry('x1', 'experience', 'Assistante commerciale (Acme)', {
      subtitle: 'Acme', startDate: '2021-01', isCurrent: true,
      description: '- Suivi de 12 comptes clients avec Salesforce', tags: ['angle:expertise', 'UX/UI'],
    }),
    makeEntry('x2', 'experience', 'Technicien support', {
      subtitle: 'Globex', startDate: '2016-01', endDate: '2018-12',
      description: '- Support de niveau 2', tags: ['hide:expertise'],
    }),
    makeEntry('x3', 'experience', 'Animateur', { subtitle: 'Club fictif', startDate: '2010-01', endDate: '2012-01', tags: ['hide:expertise'] }),
    makeEntry('k1', 'skill', 'Outils de vente', { description: '- Salesforce\n- Hubspot', tags: ['angle:expertise'] }),
    makeEntry('k2', 'skill', 'Langages', { description: '- Excel\n- Facturation' }),
    makeEntry('i1', 'interest', 'Astronomie', { tags: ['hide:expertise'] }),
  ];
}

export const SOC_ANGLE: AngleSpec = {
  slug: 'expertise',
  label: 'Assistante commerciale',
  titleRule: 'profile',
  summaryStructure: '{intitulé} depuis {année}, {outils de détection}, {preuve chiffrée}',
  skillCategoryOrder: ['Outils de vente', 'Inexistante', 'Langages'],
  vocabulary: 'Vocabulaire de la détection. Aucun sigle non défini.',
  olderPolicy: 'one-line',
  leadEntryIds: ['x1', 'k1'],
  hideEntryIds: ['x2', 'x3', 'i1'],
};
