import type { MasterEntry } from '@/types/profile';
import { MONTH } from '@/lib/wizard/scratch';

/** Information obligatoire absente, avec le message affiché dans l'alerte de l'écran 4. */
export type MissingItem =
  | { kind: 'identity'; field: 'firstName' | 'lastName'; message: string }
  | { kind: 'entry'; entryId: string; field: 'title' | 'startDate'; message: string };

export interface VerifyProfile {
  firstName: string;
  lastName: string;
}

/** Nom affiché d'un poste, pour les messages d'alerte. */
export function experienceLabel(entry: Pick<MasterEntry, 'title'>): string {
  return entry.title.trim() ? `« ${entry.title.trim()} »` : 'sans intitulé';
}

/**
 * Informations obligatoires manquantes. Mêmes règles que la saisie guidée :
 * prénom et nom ; pour chaque expérience et formation, l'intitulé ; pour chaque
 * expérience, une date de début au format mois et année.
 */
export function findMissing(profile: VerifyProfile | null, entries: readonly MasterEntry[]): MissingItem[] {
  const missing: MissingItem[] = [];
  if (!profile?.firstName.trim()) missing.push({ kind: 'identity', field: 'firstName', message: 'Il manque votre prénom.' });
  if (!profile?.lastName.trim()) missing.push({ kind: 'identity', field: 'lastName', message: 'Il manque votre nom.' });

  for (const entry of entries) {
    if (entry.entryType === 'experience') {
      if (!entry.title.trim()) {
        missing.push({ kind: 'entry', entryId: entry.id, field: 'title', message: 'Il manque l\'intitulé d\'un poste.' });
      }
      if (!entry.startDate || !MONTH.test(entry.startDate)) {
        missing.push({
          kind: 'entry',
          entryId: entry.id,
          field: 'startDate',
          message: `Il manque la date de début de l'expérience ${experienceLabel(entry)}.`,
        });
      }
    } else if (entry.entryType === 'education' && !entry.title.trim()) {
      missing.push({ kind: 'entry', entryId: entry.id, field: 'title', message: 'Il manque l\'intitulé d\'une formation.' });
    }
  }
  return missing;
}

/** « Valider et continuer » n'est actif que si aucune information obligatoire ne manque. */
export function canValidateVerify(missing: readonly MissingItem[]): boolean {
  return missing.length === 0;
}
