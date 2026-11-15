import type { MasterEntry, Profile } from '@/types/profile';
import { shouldOpenAutomatically } from '@/lib/wizard/state';

/** Profil vide : ni prénom, ni nom, ni aucune entrée (expérience, formation, compétence…). */
export function isProfileEmpty(profile: Pick<Profile, 'firstName' | 'lastName'> | null, entries: readonly MasterEntry[]): boolean {
  return !profile?.firstName.trim() && !profile?.lastName.trim() && entries.length === 0;
}

/**
 * Ouverture du guide au démarrage : uniquement depuis l'accueil, au premier lancement
 * (aucun état enregistré) et avec un profil vide.
 */
export function shouldAutoOpenWizard(pathname: string, savedRaw: string | null, profile: Pick<Profile, 'firstName' | 'lastName'> | null, entries: readonly MasterEntry[]): boolean {
  return pathname === '/' && shouldOpenAutomatically(savedRaw, isProfileEmpty(profile, entries));
}

export type WizardStatus = 'jamais' | 'en-cours' | 'termine';

/** État affiché dans Paramètres › Guide de démarrage. */
export function wizardStatus(savedRaw: string | null, finished: boolean): WizardStatus {
  if (finished) return 'termine';
  return savedRaw ? 'en-cours' : 'jamais';
}
