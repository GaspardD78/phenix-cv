import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/help/HelpButton';
import { Field, FIELD, MonthYearField } from '@/components/wizard/WizardScratchForm';
import { useProfileStore } from '@/stores/profileStore';
import { useWizardStore } from '@/stores/wizardStore';
import { formatEntryDates, DEFAULT_DATE_SETTINGS } from '@/lib/entry-dates';
import { findMissing, canValidateVerify, experienceLabel, type MissingItem } from '@/lib/wizard/verify';
import {
  experienceDraft, experiencePatch, formationDraft, formationPatch, identityDraft, identityPatch,
  saveDraft, validateExperience, validateFormation, validateIdentity, validateSkillName,
  type DraftErrors, type ExperienceDraft, type FormationDraft, type IdentityDraft,
} from '@/lib/wizard/verify-edit';
import type { MasterEntry, Profile } from '@/types/profile';

/** Une seule ligne ou un seul bloc en édition à la fois. */
type EditKey = string | null;

const btnSmall = 'inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded';

function Block({ title, helpId, children, action }: { title: string; helpId: 'profil-identite' | 'profil-experiences' | 'profil-formations' | 'profil-competences'; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{title}</h2>
          <HelpButton id={helpId} />
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function FormActions({ onSave, onCancel, saving }: { onSave: () => void; onCancel: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button variant="ghost" onClick={onCancel} disabled={saving}>Annuler</Button>
      <Button onClick={onSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
    </div>
  );
}

function IdentityBlock({ profile, editing, onEdit, onClose }: { profile: Profile; editing: boolean; onEdit: () => void; onClose: () => void }) {
  const updateProfile = useProfileStore(s => s.updateProfile);
  const [draft, setDraft] = useState<IdentityDraft>(() => identityDraft(profile));
  const [errors, setErrors] = useState<DraftErrors<IdentityDraft>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (editing) { setDraft(identityDraft(profile)); setErrors({}); } }, [editing, profile]);

  const set = (k: keyof IdentityDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft(d => ({ ...d, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const out = await saveDraft(draft, validateIdentity, identityPatch, patch => updateProfile(patch));
      setErrors(out.errors);
      if (out.saved) onClose();
    } catch (err) {
      toast.error(`Enregistrement impossible : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => { setDraft(identityDraft(profile)); setErrors({}); onClose(); };

  if (!editing) {
    return (
      <Block title="Identité" helpId="profil-identite" action={<button type="button" className={btnSmall} onClick={onEdit}><Pencil className="size-4" aria-hidden />Modifier</button>}>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div><dt className="inline text-muted-foreground">Nom : </dt><dd className="inline">{[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '—'}</dd></div>
          <div><dt className="inline text-muted-foreground">Intitulé visé : </dt><dd className="inline">{profile.title || '—'}</dd></div>
          <div><dt className="inline text-muted-foreground">Ville : </dt><dd className="inline">{profile.city || '—'}</dd></div>
          <div><dt className="inline text-muted-foreground">Téléphone : </dt><dd className="inline">{profile.phone || '—'}</dd></div>
          <div><dt className="inline text-muted-foreground">E-mail : </dt><dd className="inline">{profile.email || '—'}</dd></div>
        </dl>
      </Block>
    );
  }
  return (
    <Block title="Identité" helpId="profil-identite">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="v-firstName" label="Prénom" required error={errors.firstName}><input id="v-firstName" className={FIELD} value={draft.firstName} onChange={set('firstName')} aria-invalid={errors.firstName ? true : undefined} /></Field>
        <Field id="v-lastName" label="Nom" required error={errors.lastName}><input id="v-lastName" className={FIELD} value={draft.lastName} onChange={set('lastName')} aria-invalid={errors.lastName ? true : undefined} /></Field>
        <Field id="v-title" label="Intitulé visé"><input id="v-title" className={FIELD} value={draft.title} onChange={set('title')} /></Field>
        <Field id="v-city" label="Ville"><input id="v-city" className={FIELD} value={draft.city} onChange={set('city')} /></Field>
        <Field id="v-phone" label="Téléphone"><input id="v-phone" className={FIELD} value={draft.phone} onChange={set('phone')} /></Field>
        <Field id="v-email" label="E-mail"><input id="v-email" type="email" className={FIELD} value={draft.email} onChange={set('email')} /></Field>
      </div>
      <FormActions onSave={() => void save()} onCancel={cancel} saving={saving} />
    </Block>
  );
}

function ExperienceRow({ entry, editing, onEdit, onClose }: { entry: MasterEntry; editing: boolean; onEdit: () => void; onClose: () => void }) {
  const updateEntry = useProfileStore(s => s.updateEntry);
  const [draft, setDraft] = useState<ExperienceDraft>(() => experienceDraft(entry));
  const [errors, setErrors] = useState<DraftErrors<ExperienceDraft>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (editing) { setDraft(experienceDraft(entry)); setErrors({}); } }, [editing, entry]);

  const save = async () => {
    setSaving(true);
    try {
      const out = await saveDraft(draft, validateExperience, experiencePatch, patch => updateEntry(entry.id, patch));
      setErrors(out.errors);
      if (out.saved) onClose();
    } catch (err) {
      toast.error(`Enregistrement impossible : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => { setDraft(experienceDraft(entry)); setErrors({}); onClose(); };

  if (!editing) {
    const period = formatEntryDates({ entryType: 'experience', startDate: entry.startDate, endDate: entry.endDate, isCurrent: entry.isCurrent }, null, DEFAULT_DATE_SETTINGS);
    return (
      <li className="flex items-start justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
        <div className="min-w-0 text-sm">
          <p className="font-medium">{entry.title || <span className="text-destructive">Intitulé manquant</span>}</p>
          <p className="text-muted-foreground">{[entry.subtitle, period || 'Période non renseignée'].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" className={btnSmall} onClick={onEdit} aria-label={`Modifier ${experienceLabel(entry)}`}><Pencil className="size-4" aria-hidden />Modifier</button>
      </li>
    );
  }
  return (
    <li className="space-y-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`e-${entry.id}-title`} label="Intitulé du poste" required error={errors.title}><input id={`e-${entry.id}-title`} className={FIELD} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></Field>
        <Field id={`e-${entry.id}-subtitle`} label="Entreprise"><input id={`e-${entry.id}-subtitle`} className={FIELD} value={draft.subtitle} onChange={e => setDraft(d => ({ ...d, subtitle: e.target.value }))} /></Field>
        <MonthYearField id={`e-${entry.id}-start`} label="Début" required value={draft.startDate} error={errors.startDate} onChange={v => setDraft(d => ({ ...d, startDate: v }))} />
        <MonthYearField id={`e-${entry.id}-end`} label="Fin" value={draft.endDate} error={errors.endDate} disabled={draft.isCurrent} onChange={v => setDraft(d => ({ ...d, endDate: v }))} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.isCurrent} onChange={e => setDraft(d => ({ ...d, isCurrent: e.target.checked }))} />
        Je travaille toujours là
      </label>
      <FormActions onSave={() => void save()} onCancel={cancel} saving={saving} />
    </li>
  );
}

function FormationRow({ entry, editing, onEdit, onClose }: { entry: MasterEntry; editing: boolean; onEdit: () => void; onClose: () => void }) {
  const updateEntry = useProfileStore(s => s.updateEntry);
  const [draft, setDraft] = useState<FormationDraft>(() => formationDraft(entry));
  const [errors, setErrors] = useState<DraftErrors<FormationDraft>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (editing) { setDraft(formationDraft(entry)); setErrors({}); } }, [editing, entry]);

  const save = async () => {
    setSaving(true);
    try {
      const out = await saveDraft(draft, validateFormation, formationPatch, patch => updateEntry(entry.id, patch));
      setErrors(out.errors);
      if (out.saved) onClose();
    } catch (err) {
      toast.error(`Enregistrement impossible : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => { setDraft(formationDraft(entry)); setErrors({}); onClose(); };

  if (!editing) {
    const year = entry.endDate?.slice(0, 4) ?? '';
    return (
      <li className="flex items-start justify-between gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
        <div className="min-w-0 text-sm">
          <p className="font-medium">{entry.title || <span className="text-destructive">Intitulé manquant</span>}</p>
          <p className="text-muted-foreground">{[entry.subtitle, year].filter(Boolean).join(' · ') || 'Année non renseignée'}</p>
        </div>
        <button type="button" className={btnSmall} onClick={onEdit} aria-label={`Modifier ${entry.title || 'la formation'}`}><Pencil className="size-4" aria-hidden />Modifier</button>
      </li>
    );
  }
  return (
    <li className="space-y-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id={`f-${entry.id}-title`} label="Diplôme ou formation" required error={errors.title}><input id={`f-${entry.id}-title`} className={FIELD} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></Field>
        <Field id={`f-${entry.id}-subtitle`} label="Établissement"><input id={`f-${entry.id}-subtitle`} className={FIELD} value={draft.subtitle} onChange={e => setDraft(d => ({ ...d, subtitle: e.target.value }))} /></Field>
        <MonthYearField id={`f-${entry.id}-end`} label="Obtenu en" value={draft.endDate} error={errors.endDate} onChange={v => setDraft(d => ({ ...d, endDate: v }))} />
      </div>
      <FormActions onSave={() => void save()} onCancel={cancel} saving={saving} />
    </li>
  );
}

function SkillsBlock({ skills, profileId }: { skills: MasterEntry[]; profileId: string }) {
  const addEntry = useProfileStore(s => s.addEntry);
  const updateEntry = useProfileStore(s => s.updateEntry);
  const deleteEntry = useProfileStore(s => s.deleteEntry);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const names = skills.map(s => s.title);
  const add = async () => {
    const err = validateSkillName(newName, names);
    setAddError(err);
    if (err) return;
    try {
      await addEntry({ profileId, entryType: 'skill', title: newName.trim(), subtitle: null, location: null, startDate: null, endDate: null, isCurrent: false, description: null, metadata: {}, sortOrder: skills.length, tags: [] });
      setNewName('');
    } catch (e) {
      toast.error(`Ajout impossible : ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const rename = async (entry: MasterEntry) => {
    const others = names.filter((_, i) => skills[i].id !== entry.id);
    const err = validateSkillName(renameValue, others);
    setRenameError(err);
    if (err) return;
    try {
      await updateEntry(entry.id, { title: renameValue.trim() });
      setRenaming(null);
    } catch (e) {
      toast.error(`Modification impossible : ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const remove = async (entry: MasterEntry) => {
    try { await deleteEntry(entry.id); } catch (e) { toast.error(`Suppression impossible : ${e instanceof Error ? e.message : String(e)}`); }
  };

  return (
    <Block title="Compétences" helpId="profil-competences">
      {skills.length === 0 && <p className="text-sm text-muted-foreground">Aucune compétence pour l'instant.</p>}
      <ul className="flex flex-wrap gap-2">
        {skills.map(skill => renaming === skill.id ? (
          <li key={skill.id} className="w-full space-y-2 rounded-lg border border-border p-2">
            <Field id={`s-${skill.id}`} label="Nom de la compétence" error={renameError ?? undefined}>
              <input id={`s-${skill.id}`} className={FIELD} value={renameValue} onChange={e => setRenameValue(e.target.value)} />
            </Field>
            <FormActions onSave={() => void rename(skill)} onCancel={() => { setRenaming(null); setRenameError(null); }} saving={false} />
          </li>
        ) : (
          <li key={skill.id} className="flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1 text-sm">
            <span>{skill.title}</span>
            <button type="button" className="rounded-full p-1 text-muted-foreground hover:text-foreground" aria-label={`Renommer ${skill.title}`} onClick={() => { setRenaming(skill.id); setRenameValue(skill.title); setRenameError(null); }}><Pencil className="size-3.5" aria-hidden /></button>
            <button type="button" className="rounded-full p-1 text-muted-foreground hover:text-destructive" aria-label={`Supprimer ${skill.title}`} onClick={() => void remove(skill)}><Trash2 className="size-3.5" aria-hidden /></button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field id="s-new" label="Ajouter une compétence" error={addError ?? undefined}>
            <input id="s-new" className={FIELD} value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }} />
          </Field>
        </div>
        <Button variant="outline" className="mt-6" onClick={() => void add()} disabled={!profileId}><Plus className="size-4" aria-hidden />Ajouter</Button>
      </div>
    </Block>
  );
}

function MissingAlert({ items, onFix }: { items: MissingItem[]; onFix: (key: string) => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
      <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="size-5" aria-hidden />Il manque une information obligatoire</p>
      <ul className="space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2">
            <span>{item.message}</span>
            <button type="button" className={btnSmall} onClick={() => onFix(item.kind === 'identity' ? 'identity' : `entry:${item.entryId}`)}>Corriger</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Écran 4 : vérification du profil. Édition en place, rien n'est écrit sans « Enregistrer ». */
export function WizardVerifyStep() {
  const profile = useProfileStore(s => s.profile);
  const entries = useProfileStore(s => s.entries);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const complete = useWizardStore(s => s.complete);
  const back = useWizardStore(s => s.back);
  const [editing, setEditing] = useState<EditKey>(null);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const missing = useMemo(() => findMissing(profile, entries), [profile, entries]);
  const experiences = entries.filter(e => e.entryType === 'experience').sort((a, b) => a.sortOrder - b.sortOrder);
  const formations = entries.filter(e => e.entryType === 'education').sort((a, b) => a.sortOrder - b.sortOrder);
  const skills = entries.filter(e => e.entryType === 'skill').sort((a, b) => a.sortOrder - b.sortOrder);

  if (!profile) return <p className="py-10 text-center text-sm text-muted-foreground">Chargement de votre profil…</p>;

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Vérifiez vos informations</h1>
        <p className="text-muted-foreground">Voici ce que le guide a enregistré. Corrigez ce qui est faux avant de continuer.</p>
      </div>

      {missing.length > 0 && <MissingAlert items={missing} onFix={setEditing} />}

      <IdentityBlock profile={profile} editing={editing === 'identity'} onEdit={() => setEditing('identity')} onClose={() => setEditing(null)} />

      <Block title="Expériences" helpId="profil-experiences">
        {experiences.length === 0 && <p className="text-sm text-muted-foreground">Aucune expérience enregistrée.</p>}
        <ul className="space-y-3">
          {experiences.map(entry => (
            <ExperienceRow key={`${entry.id}`} entry={entry} editing={editing === `entry:${entry.id}`} onEdit={() => setEditing(`entry:${entry.id}`)} onClose={() => setEditing(null)} />
          ))}
        </ul>
      </Block>

      <Block title="Formations" helpId="profil-formations">
        {formations.length === 0 && <p className="text-sm text-muted-foreground">Aucune formation enregistrée.</p>}
        <ul className="space-y-3">
          {formations.map(entry => (
            <FormationRow key={`${entry.id}`} entry={entry} editing={editing === `entry:${entry.id}`} onEdit={() => setEditing(`entry:${entry.id}`)} onClose={() => setEditing(null)} />
          ))}
        </ul>
      </Block>

      <SkillsBlock skills={skills} profileId={profile.id} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <Button variant="outline" onClick={() => void back()}><ArrowLeft className="size-4" aria-hidden />Retour</Button>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => void complete()} disabled={!canValidateVerify(missing)}>
            Valider et continuer <ArrowRight className="size-4" aria-hidden />
          </Button>
          {!canValidateVerify(missing) && <p className="text-xs text-muted-foreground">Complétez l'information signalée ci-dessus.</p>}
        </div>
      </div>
    </>
  );
}
