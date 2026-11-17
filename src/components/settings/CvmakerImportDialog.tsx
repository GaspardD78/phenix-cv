import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Info, X } from 'lucide-react';
import { HelpButton } from '@/components/help/HelpButton';
import { useProfileStore } from '@/stores/profileStore';
import { useCvStore } from '@/stores/cvStore';
import { useApplicationStore } from '@/stores/applicationStore';
import { importBackup, type BackupData } from '@/lib/backup';
import { describeOrigin, detectBackupOrigin } from '@/lib/cvmaker-import/detect';
import { convertCvmakerBackup, type LinkChoice } from '@/lib/cvmaker-import/convert';
import {
  applyProfileChoices, buildImportReport, dedupeEntries, profileDifferences, profileFills, restorePlan,
  type CvmakerImportMode, type CvmakerImportReport, type ExistingEntry,
} from '@/lib/cvmaker-import/merge';

type Step = 'preview' | 'existing' | 'done';
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
const shorten = (v: string) => (v.startsWith('data:image/') ? 'une photo' : v.length > 60 ? `${v.slice(0, 57)}…` : v);

/**
 * « Récupérer mes données CVmaker » : aperçu de ce qui sera importé, converti et laissé de côté ;
 * si Phénix CV contient déjà des données, choix Fusionner (sans doublon, profil au choix) ou Remplacer ;
 * puis rapport. Une sauvegarde automatique est faite avant toute écriture (lib/backup.ts).
 */
export function CvmakerImportDialog({ backup: source, onClose, onImported }: {
  backup: BackupData;
  onClose: () => void;
  /** Appelé une fois l'import réussi (ex. le guide de démarrage passe à l'étape suivante). */
  onImported?: () => void;
}) {
  const navigate = useNavigate();
  const { profile, entries } = useProfileStore();
  const cvs = useCvStore(s => s.cvs);
  const applications = useApplicationStore(s => s.applications);
  const [step, setStep] = useState<Step>('preview');
  const [link, setLink] = useState<LinkChoice>('portfolio');
  const [mode, setMode] = useState<CvmakerImportMode>('merge');
  const [takeTheirs, setTakeTheirs] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CvmakerImportReport | null>(null);

  useEffect(() => {
    void useCvStore.getState().fetchCvs();
    void useApplicationStore.getState().fetchApplications();
  }, []);

  const origin = useMemo(() => detectBackupOrigin(source), [source]);
  const { backup: converted, report: conversion } = useMemo(() => convertCvmakerBackup(source, { keepLink: link }), [source, link]);
  const existing: ExistingEntry[] = useMemo(
    () => entries.map(e => ({ id: e.id, entry_type: e.entryType, title: e.title, subtitle: e.subtitle, start_date: e.startDate })),
    [entries],
  );
  const { backup: deduped, duplicates } = useMemo(() => dedupeEntries(converted, existing), [converted, existing]);
  const current = useMemo(() => (profile ? {
    first_name: profile.firstName, last_name: profile.lastName, title: profile.title, summary: profile.summary, email: profile.email,
    phone: profile.phone, address: profile.address, city: profile.city, postal_code: profile.postalCode, country: profile.country,
    linkedin_url: profile.linkedinUrl, other_url: profile.otherUrl, driving_license: profile.drivingLicense ?? null,
    header_extras: JSON.stringify(profile.headerExtras ?? []), photo_path: profile.photoPath,
  } : null), [profile]);
  const incomingProfile = converted.modules['profiles']?.[0];
  const differences = useMemo(() => profileDifferences(current, incomingProfile), [current, incomingProfile]);
  const fills = useMemo(() => profileFills(current, incomingProfile), [current, incomingProfile]);
  const hasData = entries.length > 0 || cvs.length > 0 || applications.length > 0;
  const showLinkChoice = Boolean(conversion.links.github && conversion.links.portfolio && !current?.other_url);
  const convertedLines = conversion.converted.filter(t => !(showLinkChoice && t.startsWith('Phénix CV garde un seul lien')));
  const c = conversion.counts;

  const runImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const keepMine = new Set(differences.map(d => d.column).filter(col => !takeTheirs.has(col)));
      const finalBackup = mode === 'merge' ? applyProfileChoices(deduped, keepMine) : converted;
      const result = await importBackup(finalBackup, restorePlan(finalBackup, mode));
      setReport(buildImportReport(conversion, finalBackup, mode === 'merge' ? duplicates : [], mode, result.autoBackupPath));
      await useProfileStore.getState().fetchProfile();
      await useCvStore.getState().fetchCvs();
      await useApplicationStore.getState().fetchApplications();
      setStep('done');
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'L\'import n\'a pas pu aller au bout.');
    } finally {
      setBusy(false);
    }
  };

  const toggleTheirs = (column: string) => setTakeTheirs(prev => {
    const next = new Set(prev);
    if (next.has(column)) next.delete(column); else next.add(column);
    return next;
  });

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cvmaker-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" data-testid="cvmaker-import-dialog">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-card)] p-6 shadow-2xl text-[var(--pc-text)] space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="cvmaker-import-title" className="text-lg font-bold flex items-center gap-2">Récupérer mes données CVmaker <HelpButton id="import-cvmaker" /></h2>
            <p className="text-sm text-[var(--pc-muted)]">{describeOrigin(origin)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-[var(--pc-muted)] hover:text-[var(--pc-text)]"><X size={20} /></button>
        </div>

        {step === 'preview' && (
          <div className="space-y-4" data-testid="cvmaker-preview">
            <section>
              <h3 className="text-sm font-semibold mb-1">À importer</h3>
              <ul className="text-sm list-disc ml-5" data-testid="cvmaker-counts">
                {c.profiles > 0 && <li>Profil, coordonnées{incomingProfile?.photo_path ? ' et photo' : ''}</li>}
                {c.experiences > 0 && <li>{plural(c.experiences, 'expérience', 'expériences')}</li>}
                {c.educations > 0 && <li>{plural(c.educations, 'formation', 'formations')}</li>}
                {c.skills > 0 && <li>{plural(c.skills, 'compétence', 'compétences')}</li>}
                {c.languages > 0 && <li>{plural(c.languages, 'langue', 'langues')}</li>}
                {c.otherEntries > 0 && <li>{plural(c.otherEntries, 'autre élément', 'autres éléments')} (projets, certifications…)</li>}
                {c.cvs > 0 && <li>{plural(c.cvs, 'CV', 'CV')}</li>}
                {c.applications > 0 && <li>{plural(c.applications, 'candidature', 'candidatures')}</li>}
              </ul>
            </section>

            {showLinkChoice && (
              <fieldset className="rounded-lg border border-[var(--pc-border)] p-3 text-sm" data-testid="cvmaker-link-choice">
                <legend className="px-1 font-semibold">Votre lien personnel</legend>
                <p className="text-[var(--pc-muted)] mb-1">CVmaker avait deux liens ; Phénix CV en garde un. Lequel voulez-vous afficher sur vos CV ?</p>
                {(['portfolio', 'github'] as const).map(choice => (
                  <label key={choice} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="cvmaker-link" checked={link === choice} onChange={() => setLink(choice)} />
                    {choice === 'portfolio' ? `Votre site : ${conversion.links.portfolio}` : `Votre GitHub : ${conversion.links.github}`}
                  </label>
                ))}
              </fieldset>
            )}

            {convertedLines.length > 0 && (
              <section className="text-sm">
                <h3 className="font-semibold mb-1 flex items-center gap-1.5"><ArrowRightLeft className="w-4 h-4" aria-hidden /> Converti pour Phénix CV</h3>
                <ul className="list-disc ml-5">{convertedLines.map((t, k) => <li key={k}>{t}</li>)}</ul>
              </section>
            )}

            {conversion.ignored.length > 0 && (
              <section className="text-sm rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface)] p-3" data-testid="cvmaker-ignored">
                <h3 className="font-semibold mb-1 flex items-center gap-1.5"><Info className="w-4 h-4" aria-hidden /> Non repris</h3>
                <ul className="space-y-1">{conversion.ignored.map((i, k) => <li key={k}><strong>{i.label}</strong> : {i.reason}</li>)}</ul>
              </section>
            )}

            {conversion.warnings.length > 0 && (
              <section className="text-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                <h3 className="font-semibold mb-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" aria-hidden /> À vérifier après l'import</h3>
                <ul className="list-disc ml-5">{conversion.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul>
              </section>
            )}

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="pc-btn-secondary" onClick={onClose}>Annuler</button>
              {hasData
                ? <button type="button" className="pc-btn-primary" onClick={() => setStep('existing')}>Continuer</button>
                : <button type="button" className="pc-btn-primary" onClick={() => void runImport()} disabled={busy}>{busy ? 'Import…' : 'Importer'}</button>}
            </div>
          </div>
        )}

        {step === 'existing' && (
          <div className="space-y-4" data-testid="cvmaker-existing">
            <p className="text-sm">Phénix CV contient déjà des données ({[
              entries.length ? plural(entries.length, 'élément de profil', 'éléments de profil') : '',
              cvs.length ? plural(cvs.length, 'CV', 'CV') : '',
              applications.length ? plural(applications.length, 'candidature', 'candidatures') : '',
            ].filter(Boolean).join(', ')}). Que voulez-vous faire ?</p>

            <div role="radiogroup" className="grid gap-2">
              {([
                ['merge', 'Fusionner (conseillé)', 'Ajoute vos données CVmaker à celles de Phénix CV. Rien n\'est supprimé, et un élément déjà présent n\'est pas ajouté une seconde fois.'],
                ['replace', 'Remplacer', 'Remplace vos données Phénix CV par celles de CVmaker. Une copie de vos données actuelles est enregistrée juste avant.'],
              ] as const).map(([value, label, hint]) => (
                <label key={value} className={`rounded-lg border-2 p-3 cursor-pointer ${mode === value ? 'border-[var(--pc-accent)] bg-[var(--pc-accent-subtle)]' : 'border-[var(--pc-border)]'}`}>
                  <span className="flex items-center gap-2 font-semibold text-sm">
                    <input type="radio" name="cvmaker-mode" checked={mode === value} onChange={() => setMode(value)} /> {label}
                  </span>
                  <span className="block text-xs text-[var(--pc-muted)] mt-1 ml-6">{hint}</span>
                </label>
              ))}
            </div>

            {mode === 'merge' && duplicates.length > 0 && (
              <section className="text-sm" data-testid="cvmaker-duplicates">
                <h3 className="font-semibold mb-1">Déjà dans Phénix CV : pas ajoutés une seconde fois</h3>
                <ul className="list-disc ml-5">{duplicates.map(d => <li key={d.incomingId}>{d.label}</li>)}</ul>
              </section>
            )}

            {mode === 'merge' && differences.length > 0 && (
              <section className="text-sm space-y-2" data-testid="cvmaker-differences">
                <h3 className="font-semibold">Votre profil : informations différentes</h3>
                <p className="text-xs text-[var(--pc-muted)]">Par défaut, vos informations Phénix CV sont gardées. Cochez celles que vous préférez reprendre de CVmaker.</p>
                {differences.map(d => (
                  <label key={d.column} className="flex items-start gap-2 cursor-pointer rounded-md border border-[var(--pc-border)] p-2">
                    <input type="checkbox" className="mt-0.5" checked={takeTheirs.has(d.column)} onChange={() => toggleTheirs(d.column)} />
                    <span><strong>{d.label}</strong> : reprendre « {shorten(d.theirs)} » à la place de « {shorten(d.mine)} »</span>
                  </label>
                ))}
              </section>
            )}

            {mode === 'merge' && fills.length > 0 && (
              <p className="text-xs text-[var(--pc-muted)]">Complété depuis CVmaker, car vide dans Phénix CV : {fills.join(', ')}.</p>
            )}

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="pc-btn-secondary" onClick={() => setStep('preview')} disabled={busy}>Retour</button>
              <button type="button" className="pc-btn-secondary" onClick={onClose} disabled={busy}>Annuler</button>
              <button type="button" className="pc-btn-primary" onClick={() => void runImport()} disabled={busy} data-testid="cvmaker-import-run">
                {busy ? 'Import…' : mode === 'replace' ? 'Remplacer mes données' : 'Fusionner'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && report && (
          <div className="space-y-4" data-testid="cvmaker-report">
            <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden /> Import terminé</p>
            <ul className="text-sm list-disc ml-5">{report.lines.map((l, k) => <li key={k}>{l}</li>)}</ul>
            {report.cvs.length > 0 && (
              <section className="text-sm">
                <h3 className="font-semibold mb-1">Vos CV importés</h3>
                <ul className="space-y-1">
                  {report.cvs.map(cv => (
                    <li key={cv.id} className="flex items-center justify-between gap-2">
                      <span>{cv.name}</span>
                      <button type="button" className="pc-btn-secondary" onClick={() => { onClose(); navigate(`/cv/${cv.id}`); }}>Ouvrir</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {report.warnings.length > 0 && (
              <section className="text-sm rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                <h3 className="font-semibold mb-1">À vérifier</h3>
                <ul className="list-disc ml-5">{report.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul>
              </section>
            )}
            {report.autoBackupPath && (
              <p className="text-xs text-[var(--pc-muted)]">Vos données d'avant l'import sont enregistrées dans le dossier de données de Phénix CV : <span className="font-mono break-all">{report.autoBackupPath}</span></p>
            )}
            <div className="flex justify-end"><button type="button" className="pc-btn-primary" onClick={onClose}>Fermer</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
