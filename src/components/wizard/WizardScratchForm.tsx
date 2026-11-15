import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useProfileStore } from '@/stores/profileStore';
import { EMPTY_SCRATCH_FORM, buildScratchResult, validateScratch, type ScratchErrors, type ScratchForm } from '@/lib/wizard/scratch';

const FIELD = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
    <form onSubmit={submit} noValidate className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Qui êtes-vous ?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="f-firstName" label="Prénom" required error={errors.firstName}><input {...input('firstName', { autoComplete: 'given-name' })} /></Field>
          <Field id="f-lastName" label="Nom" required error={errors.lastName}><input {...input('lastName', { autoComplete: 'family-name' })} /></Field>
        </div>
        <Field id="f-headline" label="Intitulé de votre profil, par exemple « Assistante commerciale »"><input {...input('headline')} /></Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Une expérience</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="f-expTitle" label="Intitulé du poste" required error={errors.expTitle}><input {...input('expTitle')} /></Field>
          <Field id="f-expCompany" label="Entreprise"><input {...input('expCompany')} /></Field>
          <Field id="f-expStart" label="Début (mois et année)" required error={errors.expStart}><input type="month" {...input('expStart')} /></Field>
          <Field id="f-expEnd" label="Fin (mois et année)" error={errors.expEnd}>
            <input type="month" {...input('expEnd', { disabled: form.expCurrent })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.expCurrent} onChange={e => set('expCurrent', e.target.checked)} />
          Je travaille toujours là
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold">Une formation</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="f-eduTitle" label="Diplôme ou formation" required error={errors.eduTitle}><input {...input('eduTitle')} /></Field>
          <Field id="f-eduSchool" label="Établissement"><input {...input('eduSchool')} /></Field>
          <Field id="f-eduEnd" label="Année d'obtention (mois et année)" error={errors.eduEnd}><input type="month" {...input('eduEnd')} /></Field>
        </div>
      </fieldset>

      <p className="text-sm text-muted-foreground">Vous pourrez tout compléter ensuite dans Mon profil.</p>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer et continuer'} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
