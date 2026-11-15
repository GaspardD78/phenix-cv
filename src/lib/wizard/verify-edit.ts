import type { MasterEntry, Profile } from '@/types/profile';
import { MONTH } from '@/lib/wizard/scratch';

/**
 * Édition en place de l'écran 4. Un brouillon part toujours des valeurs enregistrées ;
 * « Annuler » le remet à ces valeurs, et rien n'est écrit sans « Enregistrer ».
 */

export interface IdentityDraft {
  firstName: string;
  lastName: string;
  title: string;
  city: string;
  phone: string;
  email: string;
}

export interface ExperienceDraft {
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface FormationDraft {
  title: string;
  subtitle: string;
  endDate: string;
}

export type DraftErrors<T> = Partial<Record<keyof T, string>>;

/** Résultat d'une tentative d'enregistrement : `saved` faux si le brouillon est invalide (rien n'est écrit). */
export interface SaveOutcome<T> {
  saved: boolean;
  errors: DraftErrors<T>;
}

const blank = (v: string | null | undefined) => v ?? '';
const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function identityDraft(profile: Profile): IdentityDraft {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    title: blank(profile.title),
    city: blank(profile.city),
    phone: blank(profile.phone),
    email: blank(profile.email),
  };
}

export function validateIdentity(d: IdentityDraft): DraftErrors<IdentityDraft> {
  const errors: DraftErrors<IdentityDraft> = {};
  if (!d.firstName.trim()) errors.firstName = 'Indiquez votre prénom.';
  if (!d.lastName.trim()) errors.lastName = 'Indiquez votre nom.';
  return errors;
}

export function identityPatch(d: IdentityDraft): Partial<Profile> {
  return {
    firstName: d.firstName.trim(),
    lastName: d.lastName.trim(),
    title: orNull(d.title),
    city: orNull(d.city),
    phone: orNull(d.phone),
    email: orNull(d.email),
  };
}

export function experienceDraft(entry: MasterEntry): ExperienceDraft {
  return {
    title: entry.title,
    subtitle: blank(entry.subtitle),
    startDate: blank(entry.startDate),
    endDate: blank(entry.endDate),
    isCurrent: entry.isCurrent,
  };
}

export function validateExperience(d: ExperienceDraft): DraftErrors<ExperienceDraft> {
  const errors: DraftErrors<ExperienceDraft> = {};
  if (!d.title.trim()) errors.title = 'Indiquez l\'intitulé du poste.';
  if (!MONTH.test(d.startDate)) errors.startDate = 'Indiquez le mois et l\'année de début.';
  if (!d.isCurrent && d.endDate && !MONTH.test(d.endDate)) errors.endDate = 'Indiquez le mois et l\'année de fin.';
  else if (!d.isCurrent && d.endDate && d.endDate < d.startDate) errors.endDate = 'La fin doit être après le début.';
  return errors;
}

export function experiencePatch(d: ExperienceDraft): Partial<MasterEntry> {
  return {
    title: d.title.trim(),
    subtitle: orNull(d.subtitle),
    startDate: d.startDate,
    endDate: d.isCurrent ? null : orNull(d.endDate),
    isCurrent: d.isCurrent,
  };
}

export function formationDraft(entry: MasterEntry): FormationDraft {
  return { title: entry.title, subtitle: blank(entry.subtitle), endDate: blank(entry.endDate) };
}

export function validateFormation(d: FormationDraft): DraftErrors<FormationDraft> {
  const errors: DraftErrors<FormationDraft> = {};
  if (!d.title.trim()) errors.title = 'Indiquez le diplôme ou la formation.';
  if (d.endDate && !MONTH.test(d.endDate)) errors.endDate = 'Indiquez le mois et l\'année d\'obtention.';
  return errors;
}

export function formationPatch(d: FormationDraft): Partial<MasterEntry> {
  return { title: d.title.trim(), subtitle: orNull(d.subtitle), endDate: orNull(d.endDate) };
}

/** Nom de compétence : non vide et sans doublon (sans tenir compte de la casse). */
export function validateSkillName(name: string, others: readonly string[]): string | null {
  const clean = name.trim();
  if (!clean) return 'Indiquez le nom de la compétence.';
  if (others.some(o => o.trim().toLowerCase() === clean.toLowerCase())) return 'Cette compétence existe déjà.';
  return null;
}

/**
 * Enregistre un brouillon : n'appelle `write` que si le brouillon est valide.
 * `validate` et `toPatch` sont fournis par le type de ligne (identité, expérience, formation).
 */
export async function saveDraft<T, P>(
  draft: T,
  validate: (d: T) => DraftErrors<T>,
  toPatch: (d: T) => P,
  write: (patch: P) => Promise<void>,
): Promise<SaveOutcome<T>> {
  const errors = validate(draft);
  if (Object.keys(errors).length > 0) return { saved: false, errors };
  await write(toPatch(draft));
  return { saved: true, errors: {} };
}
