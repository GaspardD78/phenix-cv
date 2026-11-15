import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '@/stores/profileStore';
import { EntryType, MasterEntry, Profile } from '@/types/profile';
import { toast } from 'sonner';
import { confirm } from '@tauri-apps/plugin-dialog';
import { PhotoCropModal } from './PhotoCropModal';
import { AiEnrichModal } from './AiEnrichModal';
import { HeaderExtrasEditor } from './HeaderExtrasEditor';
import { parseHeaderExtras } from '@/lib/header-extras';
import { VariantHistoryPanel } from './VariantHistoryPanel';
import { DuplicateScanModal } from './DuplicateScanModal';
import { HelpButton } from '@/components/help/HelpButton';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  background: 'var(--pc-card)', border: '1px solid var(--pc-border)',
  color: 'var(--pc-text)', fontSize: 13, fontFamily: 'var(--font-body)',
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.12s',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: 'var(--pc-muted)', textTransform: 'uppercase',
  letterSpacing: '0.06em', fontFamily: 'var(--font-body)',
  marginBottom: 5,
};

function PcInput({ name, type = 'text', defaultValue, placeholder, required }: {
  name: string; type?: string; defaultValue?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <input
      name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} required={required}
      style={inputStyle}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--pc-accent)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--pc-border)'; }}
    />
  );
}

function PcTextarea({ name, rows = 3, defaultValue, placeholder }: {
  name: string; rows?: number; defaultValue?: string; placeholder?: string;
}) {
  return (
    <textarea
      name={name} rows={rows} defaultValue={defaultValue} placeholder={placeholder}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--pc-accent)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--pc-border)'; }}
    />
  );
}

function PcSelect({ name, value, onChange, children }: {
  name: string; value?: string; onChange?: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      name={name} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
    >{children}</select>
  );
}

function EntryFormFields({ entryToEdit, defaultTab, availableTypes }: {
  entryToEdit?: MasterEntry;
  defaultTab: EntryType | 'all';
  availableTypes: { value: EntryType; label: string }[];
}) {
  const [selectedType, setSelectedType] = useState<EntryType>(
    entryToEdit?.entryType || (defaultTab !== 'all' ? defaultTab as EntryType : 'experience')
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div>
        <label style={labelStyle}>Type</label>
        <PcSelect name="entryType" value={selectedType} onChange={(v) => setSelectedType(v as EntryType)}>
          {availableTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </PcSelect>
      </div>

      {selectedType === 'skill' ? (
        <>
          <div>
            <label style={labelStyle}>Nom de la compétence *</label>
            <PcInput name="title" defaultValue={entryToEdit?.title || ''} required />
          </div>
          <div>
            <label style={labelStyle}>Niveau (optionnel)</label>
            <PcInput name="subtitle" defaultValue={entryToEdit?.subtitle || ''} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Description / Détails (optionnel)</label>
            <PcTextarea name="description" rows={2} defaultValue={entryToEdit?.description || ''} />
            <p style={{ fontSize: 11, color: 'var(--pc-muted)', marginTop: 5, fontFamily: 'var(--font-body)' }}>
              <code style={{ background: 'var(--pc-surface)', padding: '1px 4px', borderRadius: 3 }}>- texte</code> liste ·{' '}
              <code style={{ background: 'var(--pc-surface)', padding: '1px 4px', borderRadius: 3 }}>**texte**</code> gras
            </p>
          </div>
          <input type="hidden" name="location" value="" />
          <input type="hidden" name="startDate" value="" />
          <input type="hidden" name="endDate" value="" />
        </>
      ) : selectedType === 'language' ? (
        <>
          <div>
            <label style={labelStyle}>Langue *</label>
            <PcInput name="title" defaultValue={entryToEdit?.title || ''} placeholder="Ex: Anglais, Espagnol…" required />
          </div>
          <div>
            <label style={labelStyle}>Niveau (optionnel)</label>
            <PcInput name="subtitle" defaultValue={entryToEdit?.subtitle || ''} placeholder="Ex: B2, Courant, Natif…" />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Description / Détails (optionnel)</label>
            <PcTextarea name="description" rows={2} defaultValue={entryToEdit?.description || ''} />
          </div>
          <input type="hidden" name="location" value="" />
          <input type="hidden" name="startDate" value="" />
          <input type="hidden" name="endDate" value="" />
        </>
      ) : selectedType === 'education' ? (
        <>
          <div>
            <label style={labelStyle}>Diplôme *</label>
            <PcInput name="title" defaultValue={entryToEdit?.title || ''} required />
          </div>
          <div>
            <label style={labelStyle}>École / Établissement</label>
            <PcInput name="subtitle" defaultValue={entryToEdit?.subtitle || ''} />
          </div>
          <div>
            <label style={labelStyle}>Ville</label>
            <PcInput name="location" defaultValue={entryToEdit?.location || ''} />
          </div>
          <div />
          <div>
            <label style={labelStyle}>Date de début</label>
            <PcInput name="startDate" placeholder="YYYY-MM" defaultValue={entryToEdit?.startDate || ''} />
          </div>
          <div>
            <label style={labelStyle}>Date de fin</label>
            <PcInput name="endDate" placeholder="YYYY-MM" defaultValue={entryToEdit?.endDate || ''} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--pc-text)', fontFamily: 'var(--font-body)' }}>
              <input type="checkbox" name="isCurrent" defaultChecked={entryToEdit?.isCurrent || false} />
              En cours
            </label>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Mention / Description</label>
            <PcTextarea name="description" rows={3} defaultValue={entryToEdit?.description || ''} />
          </div>
        </>
      ) : (
        <>
          <div>
            <label style={labelStyle}>Poste / Titre *</label>
            <PcInput name="title" defaultValue={entryToEdit?.title || ''} required />
          </div>
          <div>
            <label style={labelStyle}>Entreprise / Organisation</label>
            <PcInput name="subtitle" defaultValue={entryToEdit?.subtitle || ''} />
          </div>
          <div>
            <label style={labelStyle}>Lieu</label>
            <PcInput name="location" defaultValue={entryToEdit?.location || ''} />
          </div>
          <div />
          <div>
            <label style={labelStyle}>Date de début</label>
            <PcInput name="startDate" placeholder="YYYY-MM" defaultValue={entryToEdit?.startDate || ''} />
          </div>
          <div>
            <label style={labelStyle}>Date de fin</label>
            <PcInput name="endDate" placeholder="YYYY-MM" defaultValue={entryToEdit?.endDate || ''} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--pc-text)', fontFamily: 'var(--font-body)' }}>
              <input type="checkbox" name="isCurrent" defaultChecked={entryToEdit?.isCurrent || false} />
              En cours
            </label>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Description</label>
            <PcTextarea name="description" rows={3} defaultValue={entryToEdit?.description || ''} />
            <p style={{ fontSize: 11, color: 'var(--pc-muted)', marginTop: 5, fontFamily: 'var(--font-body)' }}>
              <code style={{ background: 'var(--pc-surface)', padding: '1px 4px', borderRadius: 3 }}>- texte</code> liste ·{' '}
              <code style={{ background: 'var(--pc-surface)', padding: '1px 4px', borderRadius: 3 }}>**texte**</code> gras
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  experience: 'Expérience', education: 'Formation', skill: 'Compétence',
  certification: 'Certification', language: 'Langue', project: 'Projet',
  interest: 'Intérêt', volunteer: 'Bénévolat',
};

export function ProfilePage() {
  const navigate = useNavigate();
  const { profile, entries, fetchProfile, updateProfile, addEntry, updateEntry, deleteEntry, isLoading, error } = useProfileStore();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [isEnrichModalOpen, setIsEnrichModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EntryType | 'all'>('all');
  const [historyEntryId, setHistoryEntryId] = useState<string | null>(null);
  const [isDuplicateScanOpen, setIsDuplicateScanOpen] = useState(false);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCropImageSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (base64: string) => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
    try {
      await updateProfile({ photoPath: base64 });
      toast.success('Photo de profil mise à jour');
    } catch { toast.error("Erreur lors de l'enregistrement de la photo"); }
  };

  const handleCropCancel = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
  };

  const handleRemovePhoto = async () => {
    try {
      await updateProfile({ photoPath: null });
      toast.success('Photo supprimée');
    } catch { toast.error('Erreur lors de la suppression de la photo'); }
  };

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleProfileSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') updates[key] = value;
    }
    if (!profile) {
      if (!updates.firstName?.trim()) updates.firstName = 'Prénom';
      if (!updates.lastName?.trim()) updates.lastName = 'Nom';
    }
    const payload: Partial<Profile> = {
      ...updates,
      drivingLicense: updates.drivingLicense?.trim() || null,
      headerExtras: parseHeaderExtras(updates.headerExtras),
    };
    try {
      await updateProfile(payload);
      setIsEditingProfile(false);
      toast.success(profile ? 'Profil mis à jour' : 'Profil créé');
    } catch (err) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    }
  };

  const handleAddEntry = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!profile) return;
    const entryData = {
      entryType: formData.get('entryType') as EntryType,
      title: formData.get('title') as string,
      subtitle: formData.get('subtitle') as string,
      location: formData.get('location') as string,
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      isCurrent: formData.get('isCurrent') === 'on',
      description: formData.get('description') as string,
    };
    try {
      if (editingEntryId) {
        await updateEntry(editingEntryId, entryData);
        setEditingEntryId(null);
        toast.success('Entrée modifiée');
      } else {
        await addEntry({ profileId: profile.id, ...entryData, metadata: {}, sortOrder: entries.length, tags: [] });
        setIsAddingEntry(false);
        toast.success('Nouvelle entrée ajoutée');
      }
    } catch { toast.error("Erreur lors de la sauvegarde"); }
  };

  const handleDeleteEntry = async (id: string) => {
    const ok = await confirm('Supprimer cette entrée ? Elle sera retirée de tous vos CV.', { title: 'Confirmer', kind: 'warning' });
    if (ok) {
      try { await deleteEntry(id); toast.success('Entrée supprimée'); }
      catch { toast.error('Erreur lors de la suppression'); }
    }
  };

  useEffect(() => { if (error) toast.error(error); }, [error]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--pc-bg)', color: 'var(--pc-muted)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
        Chargement du profil...
      </div>
    );
  }

  const availableTypes: { value: EntryType; label: string }[] = [
    { value: 'experience', label: 'Expériences' }, { value: 'education', label: 'Formations' },
    { value: 'skill', label: 'Compétences' }, { value: 'certification', label: 'Certifications' },
    { value: 'language', label: 'Langues' }, { value: 'project', label: 'Projets' },
    { value: 'interest', label: 'Intérêts' }, { value: 'volunteer', label: 'Bénévolat' },
  ];

  const filteredEntries = activeTab === 'all' ? entries : entries.filter(e => e.entryType === activeTab);

  const initials = profile ? `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() : '?';

  if (!profile && !isEditingProfile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--pc-bg)' }}>
        <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--pc-border)', background: 'var(--pc-surface)' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--pc-text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.4px', margin: 0 }}>Créer votre Profil</h1>
        </div>
        <div style={{ padding: '28px 32px' }}>
          <div style={{ background: 'var(--pc-card)', border: '1px solid var(--pc-border)', borderRadius: 14, padding: 24, maxWidth: 600 }}>
            <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div><label style={labelStyle}>Prénom *</label><PcInput name="firstName" required /></div>
                <div><label style={labelStyle}>Nom *</label><PcInput name="lastName" required /></div>
                <div><label style={labelStyle}>Email</label><PcInput name="email" type="email" /></div>
                <div><label style={labelStyle}>Téléphone</label><PcInput name="phone" /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="pc-btn-primary">Créer le profil</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--pc-bg)' }}>

      {/* Page header */}
      <div style={{
        padding: '28px 32px 20px', borderBottom: '1px solid var(--pc-border)',
        background: 'var(--pc-surface)', flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div className="flex items-center gap-2"><h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--pc-text)', fontFamily: 'var(--font-display)', letterSpacing: '-0.4px', margin: 0 }}>Mon profil</h1><HelpButton id="profil" /></div>
          <p style={{ fontSize: 13, color: 'var(--pc-muted)', margin: '4px 0 0', fontFamily: 'var(--font-body)' }}>
            Vos informations personnelles et expériences
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="pc-btn-secondary" onClick={() => navigate('/import')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Importer
          </button>
          <button className="pc-btn-secondary" onClick={() => setIsEnrichModalOpen(true)} style={{ color: 'var(--pc-accent)' }}>
            ✨ Enrichir avec une IA
          </button>
          <button className="pc-btn-secondary" onClick={() => setIsEditingProfile(!isEditingProfile)}>
            {isEditingProfile ? 'Annuler' : 'Modifier'}
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900, width: '100%' }}>

        {/* Profile card */}
        <div style={{ background: 'var(--pc-card)', border: '1px solid var(--pc-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--pc-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--pc-text)', fontFamily: 'var(--font-display)', flex: 1 }}>Informations personnelles</h3>
          </div>
          <div style={{ padding: 20 }}>
            {isEditingProfile ? (
              <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div><label style={labelStyle}>Prénom</label><PcInput name="firstName" defaultValue={profile?.firstName || ''} required /></div>
                  <div><label style={labelStyle}>Nom</label><PcInput name="lastName" defaultValue={profile?.lastName || ''} required /></div>
                  <div><label style={labelStyle}>Email</label><PcInput name="email" type="email" defaultValue={profile?.email || ''} /></div>
                  <div><label style={labelStyle}>Téléphone</label><PcInput name="phone" defaultValue={profile?.phone || ''} /></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Adresse</label><PcInput name="address" defaultValue={profile?.address || ''} /></div>
                  <div><label style={labelStyle}>Ville</label><PcInput name="city" defaultValue={profile?.city || ''} /></div>
                  <div><label style={labelStyle}>Code postal</label><PcInput name="postalCode" defaultValue={profile?.postalCode || ''} /></div>
                  <div><label style={labelStyle}>Pays</label><PcInput name="country" defaultValue={profile?.country || 'France'} /></div>
                  <div><label style={labelStyle}>Titre professionnel</label><PcInput name="title" defaultValue={profile?.title || ''} /></div>
                  <div><label style={labelStyle}>LinkedIn URL</label><PcInput name="linkedinUrl" type="url" defaultValue={profile?.linkedinUrl || ''} /></div>
                  <div><label style={labelStyle}>Permis de conduire</label><PcInput name="drivingLicense" defaultValue={profile?.drivingLicense || ''} placeholder="Ex : Permis B" /></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Mentions d'en-tête</label><HeaderExtrasEditor name="headerExtras" initial={profile?.headerExtras} /></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Autre lien (site web, portfolio…)</label><PcInput name="otherUrl" type="url" defaultValue={profile?.otherUrl || ''} /></div>
                  <div style={{ gridColumn: 'span 2' }}><label style={labelStyle}>Résumé</label><PcTextarea name="summary" rows={3} defaultValue={profile?.summary || ''} /></div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelStyle}>Photo de profil</label>
                    {profile?.photoPath && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <img src={profile.photoPath} alt="Photo actuelle" style={{ width: 52, height: 52, borderRadius: 99, objectFit: 'cover', border: '2px solid var(--pc-border)' }} />
                        <button type="button" onClick={handleRemovePhoto} style={{ fontSize: 12, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Supprimer la photo</button>
                      </div>
                    )}
                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ fontSize: 12, color: 'var(--pc-muted)', fontFamily: 'var(--font-body)', cursor: 'pointer' }} />
                    <p style={{ fontSize: 11, color: 'var(--pc-muted)', marginTop: 5, fontFamily: 'var(--font-body)' }}>JPG, PNG, WebP · 200×200 px recommandé</p>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                  <button type="button" className="pc-btn-secondary" onClick={() => setIsEditingProfile(false)}>Annuler</button>
                  <button type="submit" className="pc-btn-primary">Enregistrer</button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Avatar + name row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  {profile?.photoPath ? (
                    <img src={profile.photoPath} alt="Photo de profil" style={{ width: 72, height: 72, borderRadius: 99, objectFit: 'cover', border: '2px solid var(--pc-border)' }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 99, background: 'linear-gradient(135deg, var(--pc-accent), var(--pc-accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                      {initials}
                    </div>
                  )}
                  <div>
                    <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: 'var(--pc-text)', fontFamily: 'var(--font-display)' }}>
                      {profile?.firstName} {profile?.lastName}
                    </h2>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--pc-muted)', fontFamily: 'var(--font-body)' }}>
                      {profile?.title || '—'}{profile?.city ? ` · ${profile.city}` : ''}
                    </p>
                  </div>
                </div>

                {/* Info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Email', value: profile?.email },
                    { label: 'Téléphone', value: profile?.phone },
                    { label: 'Ville', value: profile?.city },
                    { label: 'Pays', value: profile?.country },
                    { label: 'LinkedIn', value: profile?.linkedinUrl },
                    { label: 'Autre lien', value: profile?.otherUrl },
                    { label: 'Permis', value: profile?.drivingLicense },
                    { label: "Mentions d'en-tête", value: parseHeaderExtras(profile?.headerExtras).join(' · ') },
                  ].map(f => (
                    <div key={f.label}>
                      <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, color: 'var(--pc-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-body)' }}>{f.label}</p>
                      <p style={{ margin: 0, fontSize: 13, color: f.value ? 'var(--pc-text)' : 'var(--pc-muted)', fontFamily: 'var(--font-body)', fontStyle: f.value ? 'normal' : 'italic' }}>{f.value || '—'}</p>
                    </div>
                  ))}
                </div>

                {profile?.summary && (
                  <div style={{ background: 'var(--pc-surface)', border: '1px solid var(--pc-border)', borderRadius: 10, padding: 14 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: 'var(--pc-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-body)' }}>Résumé</p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--pc-text)', lineHeight: 1.6, fontFamily: 'var(--font-body)' }}>{profile.summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Entries section */}
        <div style={{ background: 'var(--pc-card)', border: '1px solid var(--pc-border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--pc-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--pc-text)', fontFamily: 'var(--font-display)', flex: 1 }}>
              Expériences, Formations & Compétences
            </h3>
            {!isAddingEntry && !editingEntryId && (
              <>
                {new Set(entries.map(e => e.entryType)).size < entries.length && (
                  <button className="pc-btn-secondary" onClick={() => setIsDuplicateScanOpen(true)} title="Détecter les doublons dans toutes les sections du profil maître (expériences, formations, compétences…)" style={{ padding: '5px 12px', fontSize: 12 }}>
                    Scanner les doublons
                  </button>
                )}
                <button className="pc-btn-primary" onClick={() => setIsAddingEntry(true)} style={{ padding: '5px 12px', fontSize: 12 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Ajouter
                </button>
              </>
            )}
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--pc-border)', padding: '0 8px', flexShrink: 0 }}>
            {[{ value: 'all' as const, label: 'Tout' }, ...availableTypes].map(tab => {
              const active = activeTab === tab.value;
              return (
                <button key={tab.value} onClick={() => setActiveTab(tab.value as EntryType | 'all')} style={{
                  padding: '10px 12px 8px', fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--font-body)', background: 'none', border: 'none',
                  borderBottom: `2px solid ${active ? 'var(--pc-accent)' : 'transparent'}`,
                  color: active ? 'var(--pc-accent)' : 'var(--pc-muted)',
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s',
                }}>{tab.label}</button>
              );
            })}
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* New entry form */}
            {isAddingEntry && (
              <form onSubmit={handleAddEntry} style={{ background: 'var(--pc-surface)', border: '1px solid var(--pc-border)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--pc-text)', fontFamily: 'var(--font-display)' }}>Nouvelle entrée</h4>
                <EntryFormFields key="new" entryToEdit={undefined} defaultTab={activeTab} availableTypes={availableTypes} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="pc-btn-secondary" onClick={() => { setIsAddingEntry(false); setEditingEntryId(null); }}>Annuler</button>
                  <button type="submit" className="pc-btn-primary">Sauvegarder</button>
                </div>
              </form>
            )}

            {filteredEntries.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--pc-muted)', fontSize: 13, fontFamily: 'var(--font-body)' }}>
                Aucune entrée pour cette catégorie.
              </div>
            ) : (
              filteredEntries.map(entry => (
                <div key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: editingEntryId === entry.id ? '8px 8px 0 0' : 8, background: 'var(--pc-surface)', border: `1px solid ${editingEntryId === entry.id ? 'var(--pc-accent)' : 'var(--pc-border)'}`, borderBottom: editingEntryId === entry.id ? '1px solid var(--pc-accent)' : undefined }}
                    className={editingEntryId !== entry.id ? 'pc-hoverable-border' : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--pc-accent)', background: 'var(--pc-accent-subtle)', borderRadius: 99, padding: '2px 8px', fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                      </span>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pc-text)', fontFamily: 'var(--font-body)' }}>{entry.title}</span>
                        {(entry.subtitle || entry.location) && (
                          <span style={{ fontSize: 12, color: 'var(--pc-muted)', marginLeft: 8, fontFamily: 'var(--font-body)' }}>
                            {entry.subtitle}{entry.location ? ` · ${entry.location}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {entry.entryType === 'experience' && (
                        <button onClick={() => setHistoryEntryId(historyEntryId === entry.id ? null : entry.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--pc-border)', background: 'transparent', color: 'var(--pc-muted)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 0.12s' }}>
                          {historyEntryId === entry.id ? 'Masquer historique' : 'Voir l\'historique des variantes'}
                        </button>
                      )}
                      <button onClick={() => setEditingEntryId(editingEntryId === entry.id ? null : entry.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--pc-border)', background: 'transparent', color: 'var(--pc-accent)', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 0.12s' }}>
                        {editingEntryId === entry.id ? 'Annuler' : 'Modifier'}
                      </button>
                      <button onClick={() => handleDeleteEntry(entry.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: '#f87171', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 0.12s' }}
                        className="pc-hoverable-danger"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                  {historyEntryId === entry.id && (
                    <div style={{ background: 'var(--pc-card)', border: '1px solid var(--pc-border)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 14 }}>
                      <VariantHistoryPanel masterEntryId={entry.id} />
                    </div>
                  )}
                  {editingEntryId === entry.id && (
                    <form onSubmit={handleAddEntry} style={{ background: 'var(--pc-surface)', border: '1px solid var(--pc-accent)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <EntryFormFields key={entry.id} entryToEdit={entry} defaultTab={activeTab} availableTypes={availableTypes} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" className="pc-btn-secondary" onClick={() => setEditingEntryId(null)}>Annuler</button>
                        <button type="submit" className="pc-btn-primary">Sauvegarder</button>
                      </div>
                    </form>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {cropImageSrc && (
        <PhotoCropModal imageSrc={cropImageSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}

      {isEnrichModalOpen && (
        <AiEnrichModal onClose={() => setIsEnrichModalOpen(false)} />
      )}

      {isDuplicateScanOpen && (
        <DuplicateScanModal onClose={() => setIsDuplicateScanOpen(false)} />
      )}
    </div>
  );
}
