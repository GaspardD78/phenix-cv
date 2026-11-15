import type { MasterEntry } from '@/types/profile';

/** Saisie guidée minimale (« Je pars de zéro ») : identité, une expérience, une formation. */
export interface ScratchForm {
  firstName: string;
  lastName: string;
  /** Intitulé du profil, ex. « Assistante commerciale » (facultatif). */
  headline: string;
  expTitle: string;
  expCompany: string;
  /** Format YYYY-MM. */
  expStart: string;
  /** Format YYYY-MM, ignoré si le poste est en cours. */
  expEnd: string;
  expCurrent: boolean;
  eduTitle: string;
  eduSchool: string;
  /** Format YYYY-MM, facultatif. */
  eduEnd: string;
}

export const EMPTY_SCRATCH_FORM: ScratchForm = {
  firstName: '', lastName: '', headline: '',
  expTitle: '', expCompany: '', expStart: '', expEnd: '', expCurrent: false,
  eduTitle: '', eduSchool: '', eduEnd: '',
};

export type ScratchErrors = Partial<Record<keyof ScratchForm, string>>;

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Renvoie les messages d'erreur par champ ; un objet vide signifie que la saisie est valable. */
export function validateScratch(form: ScratchForm): ScratchErrors {
  const errors: ScratchErrors = {};
  if (!form.firstName.trim()) errors.firstName = 'Indiquez votre prénom.';
  if (!form.lastName.trim()) errors.lastName = 'Indiquez votre nom.';
  if (!form.expTitle.trim()) errors.expTitle = 'Indiquez l\'intitulé de ce poste.';
  if (!MONTH.test(form.expStart)) {
    errors.expStart = 'Indiquez le mois et l\'année de début.';
  }
  if (!form.expCurrent && form.expEnd) {
    if (!MONTH.test(form.expEnd)) errors.expEnd = 'Indiquez le mois et l\'année de fin.';
    else if (MONTH.test(form.expStart) && form.expEnd < form.expStart) errors.expEnd = 'La fin doit être après le début.';
  }
  if (!form.eduTitle.trim()) errors.eduTitle = 'Indiquez le diplôme ou la formation.';
  if (form.eduEnd && !MONTH.test(form.eduEnd)) errors.eduEnd = 'Indiquez le mois et l\'année d\'obtention.';
  return errors;
}

export interface ScratchResult {
  profile: { firstName: string; lastName: string; title: string | null };
  entries: Omit<MasterEntry, 'id' | 'createdAt' | 'updatedAt'>[];
}

/** Transforme une saisie valable en mises à jour de profil et en entrées. */
export function buildScratchResult(form: ScratchForm, profileId: string): ScratchResult {
  const trimOrNull = (v: string) => (v.trim() ? v.trim() : null);
  const base = { profileId, location: null, metadata: {}, sortOrder: 0, tags: [] as string[] };
  return {
    profile: {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      title: trimOrNull(form.headline),
    },
    entries: [
      {
        ...base,
        entryType: 'experience',
        title: form.expTitle.trim(),
        subtitle: trimOrNull(form.expCompany),
        startDate: form.expStart,
        endDate: form.expCurrent ? null : trimOrNull(form.expEnd),
        isCurrent: form.expCurrent,
        description: null,
      },
      {
        ...base,
        entryType: 'education',
        title: form.eduTitle.trim(),
        subtitle: trimOrNull(form.eduSchool),
        startDate: null,
        endDate: trimOrNull(form.eduEnd),
        isCurrent: false,
        description: null,
      },
    ],
  };
}

export const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;

/** Assemble un mois (01 à 12) et une année (4 chiffres) en « AAAA-MM ». Vide tant que l'un des deux manque. */
export function joinMonth(month: string, year: string): string {
  const y = year.trim();
  if (!/^\d{4}$/.test(y) || !/^(0[1-9]|1[0-2])$/.test(month)) return '';
  return `${y}-${month}`;
}

/** Découpe « AAAA-MM » en mois et année pour l'affichage. */
export function splitMonth(value: string): { month: string; year: string } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return m ? { year: m[1], month: m[2] } : { month: '', year: '' };
}

/** Garde d'enregistrement : rien n'est écrit tant qu'une règle obligatoire n'est pas respectée. */
export function canSave(form: ScratchForm): boolean {
  return Object.keys(validateScratch(form)).length === 0;
}

/** Champs obligatoires affichés avec un astérisque. Les autres sont facultatifs. */
export const REQUIRED_SCRATCH_FIELDS: readonly (keyof ScratchForm)[] = ['firstName', 'lastName', 'expTitle', 'expStart', 'eduTitle'];
