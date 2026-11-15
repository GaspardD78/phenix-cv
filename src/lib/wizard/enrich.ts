import type { MasterEntry, Profile } from '@/types/profile';

/** Écran 6 : complétude du profil et relances. Tout est facultatif ; rien ne bloque « Continuer ». */

export type EnrichItemId = 'summary' | 'title' | 'contact' | 'city' | 'missions' | 'skills' | 'languages';

export interface EnrichItem {
  id: EnrichItemId;
  /** Libellé court, affiché quand l'élément est fait. */
  label: string;
  /** Question posée tant que l'élément manque. */
  question: string;
  done: boolean;
}

export const MIN_SKILLS = 3;

type EnrichProfile = Pick<Profile, 'summary' | 'title' | 'email' | 'phone' | 'city'>;

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/** Expériences sans missions décrites (relance « Qu'avez-vous fait concrètement ? »). */
export function experiencesWithoutMissions(entries: readonly MasterEntry[]): MasterEntry[] {
  return entries.filter(e => e.entryType === 'experience' && !filled(e.description));
}

export function enrichItems(profile: EnrichProfile | null, entries: readonly MasterEntry[]): EnrichItem[] {
  const experiences = entries.filter(e => e.entryType === 'experience');
  const skills = entries.filter(e => e.entryType === 'skill');
  const languages = entries.filter(e => e.entryType === 'language');
  return [
    { id: 'summary', label: 'Accroche', question: 'Comment vous présenteriez-vous en deux ou trois lignes ?', done: filled(profile?.summary) },
    { id: 'title', label: 'Intitulé visé', question: 'Quel poste visez-vous ?', done: filled(profile?.title) },
    { id: 'contact', label: 'Moyen de contact', question: 'Comment un recruteur peut-il vous joindre ?', done: filled(profile?.email) || filled(profile?.phone) },
    { id: 'city', label: 'Ville', question: 'Dans quelle ville habitez-vous ?', done: filled(profile?.city) },
    { id: 'missions', label: 'Missions de vos postes', question: 'Qu\'avez-vous fait concrètement dans ces postes ?', done: experiences.length > 0 && experiencesWithoutMissions(entries).length === 0 },
    { id: 'skills', label: `Au moins ${MIN_SKILLS} compétences`, question: 'Quelles compétences utilisez-vous au quotidien ?', done: skills.length >= MIN_SKILLS },
    { id: 'languages', label: 'Une langue', question: 'Quelles langues parlez-vous ?', done: languages.length > 0 },
  ];
}

/** Pourcentage d'éléments faits, arrondi. */
export function completeness(items: readonly EnrichItem[]): number {
  if (items.length === 0) return 100;
  return Math.round((items.filter(i => i.done).length / items.length) * 100);
}

/** Au moins un moyen de contact ; e-mail au format simple s'il est rempli. */
export function validateContact(email: string, phone: string): string | null {
  if (!email.trim() && !phone.trim()) return 'Indiquez au moins un e-mail ou un téléphone.';
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Cette adresse e-mail ne semble pas complète.';
  return null;
}

/** Langue : non vide et pas déjà présente (casse ignorée). */
export function validateLanguage(name: string, existing: readonly string[]): string | null {
  const clean = name.trim();
  if (!clean) return 'Indiquez la langue.';
  if (existing.some(l => l.trim().toLowerCase() === clean.toLowerCase())) return 'Cette langue est déjà dans votre profil.';
  return null;
}

/** Texte libre (accroche, intitulé, ville, missions) : non vide après nettoyage. */
export function validateText(value: string, message: string): string | null {
  return value.trim() ? null : message;
}

/** Nombre de relances affichées d'emblée ; les autres s'ouvrent avec « Voir les autres ». */
export const VISIBLE_RELANCES = 3;

/** Relances affichées et nombre de relances masquées. */
export function visibleRelances<T>(todo: readonly T[], showAll: boolean, limit = VISIBLE_RELANCES): { shown: T[]; hidden: number } {
  if (showAll || todo.length <= limit) return { shown: [...todo], hidden: 0 };
  return { shown: todo.slice(0, limit), hidden: todo.length - limit };
}
