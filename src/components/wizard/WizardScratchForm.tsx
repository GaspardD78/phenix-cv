import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useProfileStore } from '@/stores/profileStore';
import { EMPTY_SCRATCH_FORM, MONTHS_FR, buildScratchResult, joinMonth, splitMonth, validateScratch, type ScratchErrors, type ScratchForm } from '@/lib/wizard/scratch';

const FIELD = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Field({ id, label, error, required, children }: { id: string; label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}{required ? ' *' : ''}
      </label>
      {children}
      {error && <p id={`${id}-erreur`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Mois (liste) et année (4 chiffres) : la valeur reste « AAAA-MM » pour l'enregistrement. */
function MonthYearField({ id, label, value, onChange, error, disabled }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; disabled?: boolean;
}) {
  // Brouillon local : une année incomplète reste affichée même si la valeur enregistrée est vide.
  const [draft, setDraft] = useState(() => splitMonth(value));
  useEffect(() => {
    if (joinMonth(draft.month, draft.year) !== value) setDraft(splitMonth(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const { month, year } = draft;
  const update = (next: { month: string; year: string }) => {
    setDraft(next);
    onChange(joinMonth(next.month, next.year));
  };
  const describedBy = error ? `${id}-erreur` : undefined;
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium" id={`${id}-libelle`}>{label}</span>
      <div className="grid grid-cols-[1fr_6rem] gap-2" role="group" aria-labelledby={`${id}-libelle`}>
        <select
          id={`${id}-mois`}
          aria-label={`${label} : mois`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={month}
          onChange={e => update({ month: e.target.value, year })}
          className={FIELD}
        >
          <option value="">Mois</option>
          {MONTHS_FR.map((name, i) => (
            <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>
          ))}
        </select>
        <input
          id={`${id}-annee`}
          aria-label={`${label} : année`}
          inputMode="numeric"
          maxLength={4}
          placeholder="AAAA"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          value={year}
          onChange={e => update({ month, year: e.target.value.replace(/\D/g, '') })}
          className={FIELD}
        />
      </div>
      {error && <p id={describedBy} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/** Saisie guidée minimale : identité, une expérience, une formation. */
export function WizardScratchForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<ScratchForm>(EMPTY_SCRATCH_FORM);
  const [errors, setErrors] = useState<ScratchErrors>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ScratchForm>(key: K, value: ScratchForm[K]) => setForm(f => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateScratch(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const store = useProfileStore.getState();
    setSaving(true);
    try {
      const { profile, entries } = buildScratchResult(form, store.profile?.id ?? '');
      await store.updateProfile(profile);
      for (const entry of entries) await store.addEntry(entry);
      await store.fetchProfile();
      onDone();
    } catch (err) {
      toast.error(`Impossible d'enregistrer : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const input = (key: keyof ScratchForm, props: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => ({
    id: `f-${key}`,
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value as never),
    className: FIELD,
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `f-${key}-erreur` : undefined,
    ...props,
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Qui êtes-vous ?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="f-firstName" label="Prénom" required error={errors.firstName}><input {...input('firstName', { autoComplete: 'given-name' })} /></Field>
          <Field id="f-lastName" label="Nom" required error={errors.lastName}><input {...input('lastName', { autoComplete: 'family-name' })} /></Field>
          <Field id="f-headline" label="Intitulé du profil"><input {...input('headline', { placeholder: 'ex. Assistante commerciale' })} /></Field>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Une expérience</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="f-expTitle" label="Intitulé du poste" required error={errors.expTitle}><input {...input('expTitle')} /></Field>
          <Field id="f-expCompany" label="Entreprise"><input {...input('expCompany')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MonthYearField id="f-expStart" label="Début" value={form.expStart} error={errors.expStart} onChange={v => set('expStart', v)} />
          <MonthYearField id="f-expEnd" label="Fin" value={form.expEnd} error={errors.expEnd} disabled={form.expCurrent} onChange={v => set('expEnd', v)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.expCurrent} onChange={e => set('expCurrent', e.target.checked)} />
          Je travaille toujours là
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Une formation</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="f-eduTitle" label="Diplôme ou formation" required error={errors.eduTitle}><input {...input('eduTitle')} /></Field>
          <Field id="f-eduSchool" label="Établissement"><input {...input('eduSchool')} /></Field>
          <MonthYearField id="f-eduEnd" label="Obtenu en" value={form.eduEnd} error={errors.eduEnd} onChange={v => set('eduEnd', v)} />
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer et continuer'} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
