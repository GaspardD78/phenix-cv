import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpButton } from '@/components/help/HelpButton';
import { AiEnrichModal } from '@/components/profile/AiEnrichModal';
import { Field, FIELD } from '@/components/wizard/WizardScratchForm';
import { useProfileStore } from '@/stores/profileStore';
import { useWizardStore } from '@/stores/wizardStore';
import {
  MIN_SKILLS, completeness, enrichItems, experiencesWithoutMissions, validateContact, validateLanguage, validateText, visibleRelances,
  type EnrichItem,
} from '@/lib/wizard/enrich';
import { validateSkillName } from '@/lib/wizard/verify-edit';
import type { MasterEntry } from '@/types/profile';

/** Écrit puis signale l'échec éventuel ; renvoie vrai si l'écriture a réussi. */
async function attempt(write: () => Promise<void>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch (e) {
    toast.error(`Enregistrement impossible : ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

function Relance({ item, children }: { item: EnrichItem; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card px-4 py-3">
      <h2 className="font-semibold">{item.question}</h2>
      {children}
    </section>
  );
}

function SaveRow({ onSave, saving, label = 'Enregistrer' }: { onSave: () => void; saving: boolean; label?: string }) {
  return (
    <div className="flex justify-end">
      <Button onClick={onSave} disabled={saving}>{saving ? 'Enregistrement…' : label}</Button>
    </div>
  );
}

/** Un champ texte du profil (accroche, intitulé, ville). */
function ProfileTextRelance({ item, field, label, multiline, emptyMessage }: {
  item: EnrichItem; field: 'summary' | 'title' | 'city'; label: string; multiline?: boolean; emptyMessage: string;
}) {
  const updateProfile = useProfileStore(s => s.updateProfile);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = `en-${field}`;
  const save = async () => {
    const err = validateText(value, emptyMessage);
    setError(err);
    if (err) return;
    setSaving(true);
    await attempt(() => updateProfile({ [field]: value.trim() }));
    setSaving(false);
  };
  return (
    <Relance item={item}>
      {multiline ? (
        <>
          <Field id={id} label={label} error={error ?? undefined}>
            <textarea id={id} rows={2} className={FIELD} value={value} onChange={e => setValue(e.target.value)} />
          </Field>
          <SaveRow onSave={() => void save()} saving={saving} />
        </>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Field id={id} label={label} error={error ?? undefined}>
              <input id={id} className={FIELD} value={value} onChange={e => setValue(e.target.value)} />
            </Field>
          </div>
          <Button className="mt-6" onClick={() => void save()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      )}
    </Relance>
  );
}

function ContactRelance({ item }: { item: EnrichItem }) {
  const updateProfile = useProfileStore(s => s.updateProfile);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const err = validateContact(email, phone);
    setError(err);
    if (err) return;
    setSaving(true);
    await attempt(() => updateProfile({ email: email.trim() || null, phone: phone.trim() || null }));
    setSaving(false);
  };
  return (
    <Relance item={item}>
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field id="en-email" label="E-mail"><input id="en-email" type="email" className={FIELD} value={email} onChange={e => setEmail(e.target.value)} /></Field>
        <Field id="en-phone" label="Téléphone"><input id="en-phone" className={FIELD} value={phone} onChange={e => setPhone(e.target.value)} /></Field>
        <Button className="sm:mt-6" onClick={() => void save()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </Relance>
  );
}

function MissionRow({ entry }: { entry: MasterEntry }) {
  const updateEntry = useProfileStore(s => s.updateEntry);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const id = `en-mission-${entry.id}`;
  const save = async () => {
    const err = validateText(value, 'Décrivez au moins une mission.');
    setError(err);
    if (err) return;
    setSaving(true);
    await attempt(() => updateEntry(entry.id, { description: value.trim() }));
    setSaving(false);
  };
  return (
    <div className="space-y-2">
      <Field id={id} label={[entry.title, entry.subtitle].filter(Boolean).join(' · ')} error={error ?? undefined}>
        <textarea id={id} rows={3} className={FIELD} value={value} onChange={e => setValue(e.target.value)} placeholder="Une mission par ligne, par exemple « Suivi des commandes clients »." />
      </Field>
      <SaveRow onSave={() => void save()} saving={saving} />
    </div>
  );
}

function SkillsRelance({ item, skills, profileId }: { item: EnrichItem; skills: MasterEntry[]; profileId: string }) {
  const addEntry = useProfileStore(s => s.addEntry);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    const err = validateSkillName(value, skills.map(s => s.title));
    setError(err);
    if (err) return;
    const ok = await attempt(() => addEntry({ profileId, entryType: 'skill', title: value.trim(), subtitle: null, location: null, startDate: null, endDate: null, isCurrent: false, description: null, metadata: {}, sortOrder: skills.length, tags: [] }));
    if (ok) setValue('');
  };
  return (
    <Relance item={item}>
      <p className="text-sm text-muted-foreground">
        {skills.length === 0 ? 'Aucune compétence pour l\'instant.' : `Déjà : ${skills.map(s => s.title).join(', ')}.`} Visez au moins {MIN_SKILLS}.
      </p>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field id="en-skill" label="Compétence" error={error ?? undefined}>
            <input id="en-skill" className={FIELD} value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }} />
          </Field>
        </div>
        <Button variant="outline" className="mt-6" onClick={() => void add()}><Plus className="size-4" aria-hidden />Ajouter</Button>
      </div>
    </Relance>
  );
}

function LanguageRelance({ item, languages, profileId }: { item: EnrichItem; languages: MasterEntry[]; profileId: string }) {
  const addEntry = useProfileStore(s => s.addEntry);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    const err = validateLanguage(name, languages.map(l => l.title));
    setError(err);
    if (err) return;
    const ok = await attempt(() => addEntry({ profileId, entryType: 'language', title: name.trim(), subtitle: level.trim() || null, location: null, startDate: null, endDate: null, isCurrent: false, description: null, metadata: {}, sortOrder: languages.length, tags: [] }));
    if (ok) { setName(''); setLevel(''); }
  };
  return (
    <Relance item={item}>
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field id="en-lang" label="Langue" error={error ?? undefined}><input id="en-lang" className={FIELD} value={name} onChange={e => setName(e.target.value)} placeholder="ex. Anglais" /></Field>
        <Field id="en-level" label="Niveau (facultatif)"><input id="en-level" className={FIELD} value={level} onChange={e => setLevel(e.target.value)} placeholder="ex. B2, courant" /></Field>
        <Button variant="outline" className="sm:mt-6" onClick={() => void add()}><Plus className="size-4" aria-hidden />Ajouter</Button>
      </div>
    </Relance>
  );
}

/** Écran 6 : enrichissement facultatif. Chaque relance s'enregistre seule ; « Continuer » reste toujours actif. */
export function WizardEnrichStep() {
  const profile = useProfileStore(s => s.profile);
  const entries = useProfileStore(s => s.entries);
  const fetchProfile = useProfileStore(s => s.fetchProfile);
  const complete = useWizardStore(s => s.complete);
  const back = useWizardStore(s => s.back);
  const navigate = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const items = useMemo(() => enrichItems(profile, entries), [profile, entries]);
  const percent = completeness(items);
  const skills = entries.filter(e => e.entryType === 'skill');
  const languages = entries.filter(e => e.entryType === 'language');
  const todo = items.filter(i => !i.done);
  const done = items.filter(i => i.done);
  const visible = visibleRelances(todo, showAll);
  const profileId = profile?.id ?? '';

  if (!profile) return <p className="py-10 text-center text-sm text-muted-foreground">Chargement de votre profil…</p>;

  const relance = (item: EnrichItem) => {
    switch (item.id) {
      case 'summary': return <ProfileTextRelance key={item.id} item={item} field="summary" label="Votre accroche" multiline emptyMessage="Écrivez quelques mots sur votre parcours." />;
      case 'title': return <ProfileTextRelance key={item.id} item={item} field="title" label="Intitulé visé" emptyMessage="Indiquez le poste visé." />;
      case 'contact': return <ContactRelance key={item.id} item={item} />;
      case 'city': return <ProfileTextRelance key={item.id} item={item} field="city" label="Ville" emptyMessage="Indiquez votre ville." />;
      case 'missions': {
        const missing = experiencesWithoutMissions(entries);
        if (missing.length === 0) return null;
        return <Relance key={item.id} item={item}>{missing.map(e => <MissionRow key={e.id} entry={e} />)}</Relance>;
      }
      case 'skills': return <SkillsRelance key={item.id} item={item} skills={skills} profileId={profileId} />;
      case 'languages': return <LanguageRelance key={item.id} item={item} languages={languages} profileId={profileId} />;
    }
  };

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Enrichissez votre profil</h1>
        <p className="text-muted-foreground">
          Ces informations sont facultatives, mais elles rendent votre CV plus convaincant. Complétez ce que vous voulez, puis continuez.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Profil complet à {percent} %</span>
          <span>{done.length} sur {items.length}</span>
        </div>
        <div role="progressbar" aria-label="Complétude du profil" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        {done.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
            {done.map(i => <li key={i.id} className="flex items-center gap-1"><Check className="size-4 text-primary" aria-hidden />{i.label}</li>)}
          </ul>
        )}
      </div>

      {todo.length === 0
        ? <p className="rounded-xl border border-border bg-card p-4 text-sm">Votre profil est complet. Bravo !</p>
        : visible.shown.map(relance)}
      {visible.hidden > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          Voir les autres ({visible.hidden})
        </button>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Aller plus loin avec une IA (facultatif)</h2>
            <HelpButton id="enrichir-ia" />
          </div>
          <p className="text-sm text-muted-foreground">Une IA peut proposer des formulations à partir de votre profil. Rien n'est ajouté sans votre accord.</p>
        </div>
        <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="size-4" aria-hidden />Enrichir avec une IA</Button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void back()}><ArrowLeft className="size-4" aria-hidden />Retour</Button>
          <Button variant="ghost" onClick={() => navigate('/')}>Quitter le guide</Button>
        </div>
        <Button onClick={() => void complete()}>Continuer <ArrowRight className="size-4" aria-hidden /></Button>
      </div>

      {aiOpen && <AiEnrichModal onClose={() => { setAiOpen(false); void fetchProfile(); }} />}
    </>
  );
}
