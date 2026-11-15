import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { FileUp, ExternalLink, ClipboardPaste, ArrowLeft, ArrowRight, Check, Copy, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { WikiLink } from '@/components/help/WikiLink';
import { useImportDropStore } from '@/stores/importDropStore';
import { Button } from '@/components/ui/button';
import { useProfileStore } from '@/stores/profileStore';
import type { Profile, MasterEntry } from '@/types/profile';

import type { ImportFormat, ImportPayload, ProfileFieldDiff, SelectableEntry } from '@/lib/import/types';
import { parseLinkedInZip } from '@/lib/import/linkedin-parser';
import { extractTextFromDocx } from '@/lib/import/docx-extractor';
import { buildImportPrompt } from '@/lib/import/import-prompt';
import { parseImportResponse } from '@/lib/import/extract-json';
import { classifyDroppedPaths, SCANNED_PDF_MESSAGE } from '@/lib/import/file-kind';
import { HelpButton } from '@/components/help/HelpButton';
import { applyImport } from '@/lib/import/apply-import';

// ─────────────────────────────────────────────────────────────────────────────
// Step indicators
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'source', label: 'Votre fichier' },
  { id: 'process', label: 'Lecture par une IA' },
  { id: 'preview', label: 'Vérification' },
  { id: 'done', label: 'Terminé' },
] as const;

type StepId = typeof STEPS[number]['id'];

function StepBar({ current }: { current: StepId }) {
  const idx = STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  done
                    ? 'bg-lagon-600 border-lagon-600 text-white'
                    : active
                    ? 'bg-white dark:bg-[var(--pc-bg)] border-lagon-600 text-lagon-600 dark:text-lagon-400'
                    : 'bg-white dark:bg-[var(--pc-bg)] border-gray-300 dark:border-[var(--pc-border-active)] text-gray-400 dark:text-[var(--pc-muted)]'
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`mt-1 text-xs font-medium whitespace-nowrap ${
                  active ? 'text-lagon-600 dark:text-lagon-400' : done ? 'text-lagon-500' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 mb-4 transition-colors ${done ? 'bg-lagon-600' : 'bg-gray-200 dark:bg-[var(--pc-surface)]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 1 : votre fichier (glisser-déposer ou « Choisir un fichier »)
// ─────────────────────────────────────────────────────────────────────────────

/** Lit le fichier et en tire soit des données prêtes (LinkedIn), soit du texte à faire lire par une IA. */
async function loadImportFile(path: string, format: ImportFormat): Promise<{ payload: ImportPayload | null; text?: string }> {
  const bytes = await readFile(path);
  const ab = bytes.buffer as ArrayBuffer;
  if (format === 'linkedin') {
    const payload = await parseLinkedInZip(ab);
    if (!payload.entries?.length && !payload.profile) {
      throw new Error("Aucune donnée trouvée dans ce fichier .zip. Vérifiez qu'il s'agit bien de l'export complet de LinkedIn.");
    }
    return { payload };
  }
  if (format === 'pdf') {
    // Chargé à la demande : la bibliothèque PDF est lourde et inutile tant qu'on n'importe pas de PDF.
    const { extractTextFromPdf } = await import('@/lib/import/pdf-extractor');
    const text = await extractTextFromPdf(ab);
    if (!text.trim()) throw new Error(SCANNED_PDF_MESSAGE);
    return { payload: null, text };
  }
  const text = await extractTextFromDocx(ab);
  if (!text.trim()) throw new Error("Nous n'avons pas pu lire le texte de ce document Word. Essayez de l'enregistrer en PDF, puis importez le PDF.");
  return { payload: null, text };
}

export function StepSource({
  onNext,
  onManual,
  showIntro = true,
}: {
  onNext: (format: ImportFormat, payload: ImportPayload | null, rawText?: string) => void;
  onManual: () => void;
  /** Phrase d'explication sous le titre (masquée quand l'écran la porte déjà, ex. le guide). */
  showIntro?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragging = useImportDropStore(s => s.dragging);
  const pending = useImportDropStore(s => s.pending);

  const processFile = async (path: string, format: ImportFormat) => {
    setError(null);
    setLoading(true);
    try {
      const { payload, text } = await loadImportFile(path, format);
      onNext(format, payload, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Fichier déposé n'importe où dans la fenêtre (voir GlobalFileDropGuard).
  useEffect(() => {
    if (!pending) return;
    useImportDropStore.getState().setPending(null);
    void processFile(pending.path, pending.format);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const pick = async (kind: 'cv' | 'linkedin') => {
    setError(null);
    const filePath = await open({
      filters: kind === 'cv'
        ? [{ name: 'CV (PDF ou Word)', extensions: ['pdf', 'docx'] }]
        : [{ name: 'Export LinkedIn (.zip)', extensions: ['zip'] }],
      multiple: false,
    });
    if (!filePath || typeof filePath !== 'string') return;
    const result = classifyDroppedPaths([filePath]);
    if (!result.ok) { setError(result.message); return; }
    await processFile(result.path, result.format);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">Votre CV actuel</h2>
      {showIntro && (
        <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)] mb-5">
          Déposez votre CV : nous en récupérons les informations pour remplir votre profil. Vous vérifiez tout avant que ce soit enregistré.
        </p>
      )}

      <div
        data-testid="import-dropzone"
        className={`flex flex-col items-center text-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-colors ${
          dragging
            ? 'border-lagon-500 bg-lagon-50 dark:bg-lagon-900/20'
            : 'border-gray-300 dark:border-[var(--pc-border-active)] bg-gray-50 dark:bg-[var(--pc-card)]/50'
        }`}
      >
        <FileUp className={`w-9 h-9 ${dragging ? 'text-lagon-600' : 'text-gray-400 dark:text-[var(--pc-muted)]'}`} />
        <p className="text-base font-medium text-gray-800 dark:text-[var(--pc-text)]">
          {dragging ? 'Relâchez pour importer' : 'Glissez votre CV ici'}
        </p>
        <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)]">PDF ou Word (.docx)</p>
        <Button onClick={() => void pick('cv')} disabled={loading}>
          {loading ? 'Lecture du fichier…' : 'Choisir un fichier'}
        </Button>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="mt-6 grid gap-2 text-sm">
        <button onClick={() => void pick('linkedin')} disabled={loading} className="text-left text-lagon-600 dark:text-lagon-400 hover:underline">
          J'ai un export LinkedIn (fichier .zip)
        </button>
        <button onClick={() => onNext('json', null)} disabled={loading} className="text-left text-lagon-600 dark:text-lagon-400 hover:underline">
          J'ai déjà la réponse d'une IA à coller
        </button>
        <button onClick={onManual} disabled={loading} className="text-left text-lagon-600 dark:text-lagon-400 hover:underline">
          Je préfère remplir moi-même
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 2 : lecture par une IA (facultative) ou saisie de la réponse
// ─────────────────────────────────────────────────────────────────────────────

const AI_SITES = [
  { label: 'Ouvrir ChatGPT', url: 'https://chatgpt.com/' },
  { label: 'Ouvrir Claude', url: 'https://claude.ai/new' },
  { label: 'Ouvrir Gemini', url: 'https://gemini.google.com/app' },
] as const;

function HowItWorks() {
  const items = [
    { icon: Copy, title: '1. Copier', text: 'Copiez le texte préparé par l\'application.' },
    { icon: ExternalLink, title: '2. Coller dans l\'IA', text: 'Ouvrez ChatGPT, Claude ou Gemini, collez le texte et envoyez.' },
    { icon: ClipboardPaste, title: '3. Recopier ici', text: 'Copiez la réponse de l\'IA et collez-la ci-dessous.' },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3" aria-label="Les trois étapes">
      {items.map(({ icon: Icon, title, text }) => (
        <li key={title} className="rounded-xl border border-gray-200 dark:border-[var(--pc-border)] p-3 bg-gray-50 dark:bg-[var(--pc-card)]/50">
          <Icon className="w-5 h-5 text-lagon-600 mb-1.5" aria-hidden="true" />
          <p className="text-sm font-semibold text-gray-800 dark:text-[var(--pc-text)]">{title}</p>
          <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)]">{text}</p>
        </li>
      ))}
    </ol>
  );
}

export function StepProcess({
  format,
  rawText,
  onNext,
  onBack,
  onManual,
}: {
  format: ImportFormat;
  rawText?: string;
  onNext: (payload: ImportPayload) => void;
  onBack: () => void;
  onManual: () => void;
}) {
  const [response, setResponse] = useState('');
  const [error, setError] = useState<{ message: string; advice: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const isFromFile = format === 'pdf' || format === 'docx';
  const prompt = rawText ? buildImportPrompt(rawText) : '';

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('La copie a échoué. Sélectionnez le texte dans « Voir le texte à copier » et copiez-le à la main.');
      setShowPrompt(true);
    }
  };

  const openSite = async (url: string) => {
    try {
      await openUrl(url);
    } catch {
      toast.error(`Impossible d'ouvrir le site. Ouvrez votre navigateur et allez sur ${url}`);
    }
  };

  const submit = () => {
    const result = parseImportResponse(response);
    if (result.ok) {
      setError(null);
      onNext(result.payload);
    } else {
      setError({ message: result.message, advice: result.advice });
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">
        {isFromFile ? 'Faire lire votre CV par une IA' : 'Coller la réponse d\'une IA'}
      </h2>

      {isFromFile ? (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Une IA (ChatGPT, Claude, Gemini…) range très bien les informations d'un CV : expériences, formations, compétences. Votre fichier reste sur
            votre ordinateur ; seul le texte que vous collez est envoyé, par vous, à l'IA de votre choix.{' '}
            <WikiLink page="utiliser-une-ia">Pourquoi passer par une IA ?</WikiLink>
          </p>

          <HowItWorks />

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void copyPrompt()}>
              {copied ? <><Check className="w-4 h-4 mr-2" /> Texte copié</> : <><Copy className="w-4 h-4 mr-2" /> Copier le texte</>}
            </Button>
            {AI_SITES.map(site => (
              <Button key={site.url} variant="outline" onClick={() => void openSite(site.url)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                {site.label}
              </Button>
            ))}
          </div>

          <button
            onClick={() => setShowPrompt(v => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[var(--pc-muted)] hover:text-gray-700 dark:hover:text-[var(--pc-text)]"
          >
            {showPrompt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showPrompt ? 'Masquer le texte à copier' : 'Voir le texte à copier'}
          </button>
          {showPrompt && (
            <pre className="text-xs text-gray-600 dark:text-[var(--pc-muted)] bg-gray-50 dark:bg-[var(--pc-card)] rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap border border-gray-200 dark:border-[var(--pc-border)]">
              {prompt}
            </pre>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)] mb-3">
          Collez ici la réponse de l'IA, telle quelle. Les phrases autour et les balises éventuelles ne gênent pas.
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="ai-response" className="block text-sm font-medium text-gray-700 dark:text-[var(--pc-muted)] mb-1.5">
          Réponse de l'IA
        </label>
        <textarea
          id="ai-response"
          value={response}
          onChange={e => setResponse(e.target.value)}
          placeholder="Collez ici la réponse complète de l'IA"
          rows={8}
          className="w-full rounded-lg border border-gray-300 dark:border-[var(--pc-border-active)] bg-white dark:bg-[var(--pc-card)] text-sm text-gray-800 dark:text-[var(--pc-text)] p-3 focus:outline-none focus:ring-2 focus:ring-lagon-500 resize-y"
        />
      </div>

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300 space-y-1">
            <p className="font-medium">{error.message}</p>
            <p>{error.advice}</p>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div className="flex items-center gap-4">
          <button onClick={onManual} className="text-sm text-lagon-600 dark:text-lagon-400 hover:underline">
            Je préfère remplir moi-même
          </button>
          <Button onClick={submit} disabled={!response.trim()}>
            Voir ce qui a été reconnu
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Preview & merge
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_FIELD_LABELS: Record<string, string> = {
  firstName: 'Prénom',
  lastName: 'Nom',
  email: 'Email',
  phone: 'Téléphone',
  address: 'Adresse',
  city: 'Ville',
  postalCode: 'Code postal',
  country: 'Pays',
  linkedinUrl: 'LinkedIn URL',
  otherUrl: 'Autre lien (site web, portfolio…)',
  title: 'Titre professionnel',
  summary: 'Résumé / Accroche',
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  experience: 'Expériences',
  education: 'Formations',
  skill: 'Compétences',
  certification: 'Certifications',
  language: 'Langues',
  interest: 'Intérêts',
  project: 'Projets',
  volunteer: 'Bénévolat',
};

function buildProfileDiffs(existing: Profile | null, imported: Partial<Record<string, string>>): ProfileFieldDiff[] {
  return Object.entries(PROFILE_FIELD_LABELS).map(([key, label]) => {
    const existingVal = existing ? (existing as unknown as Record<string, string | null>)[
      key === 'firstName' ? 'firstName'
      : key === 'lastName' ? 'lastName'
      : key === 'linkedinUrl' ? 'linkedinUrl'
      : key === 'otherUrl' ? 'otherUrl'
      : key === 'postalCode' ? 'postalCode'
      : key
    ] ?? null : null;
    const importedVal = imported[key] ?? null;
    return {
      key: key as ProfileFieldDiff['key'],
      label,
      existing: existingVal,
      imported: importedVal,
      useImported: !existingVal && !!importedVal, // auto: fill empty fields
    };
  }).filter(d => d.imported !== null); // only show fields that have imported data
}

function buildSelectableEntries(imported: SelectableEntry['data'][], existing: MasterEntry[]): SelectableEntry[] {
  return imported.map(entry => {
    const possibleDuplicate = existing.some(
      e =>
        e.entryType === entry.entryType &&
        e.title.toLowerCase().trim() === entry.title.toLowerCase().trim(),
    );
    return { data: entry, selected: !possibleDuplicate, possibleDuplicate };
  });
}

export function StepPreview({
  payload,
  onConfirm,
  onBack,
}: {
  payload: ImportPayload;
  onConfirm: (diffs: ProfileFieldDiff[], entries: SelectableEntry[]) => void;
  onBack: () => void;
}) {
  const { profile: existingProfile, entries: existingEntries } = useProfileStore();

  const [profileDiffs, setProfileDiffs] = useState<ProfileFieldDiff[]>(() =>
    buildProfileDiffs(existingProfile, (payload.profile ?? {}) as Partial<Record<string, string>>),
  );

  const [selectableEntries, setSelectableEntries] = useState<SelectableEntry[]>(() =>
    buildSelectableEntries(payload.entries ?? [], existingEntries),
  );

  const toggleProfileField = (key: string) => {
    setProfileDiffs(prev =>
      prev.map(d => (d.key === key ? { ...d, useImported: !d.useImported } : d)),
    );
  };

  const toggleEntry = (idx: number) => {
    setSelectableEntries(prev =>
      prev.map((e, i) => (i === idx ? { ...e, selected: !e.selected } : e)),
    );
  };

  const toggleAllEntries = (type: string, selected: boolean) => {
    setSelectableEntries(prev =>
      prev.map(e => (e.data.entryType === type ? { ...e, selected } : e)),
    );
  };

  const selectedCount = selectableEntries.filter(e => e.selected).length;
  const profileChanges = profileDiffs.filter(d => d.useImported).length;

  // Group entries by type
  const entriesByType = selectableEntries.reduce<Record<string, { entry: SelectableEntry; idx: number }[]>>(
    (acc, entry, idx) => {
      const t = entry.data.entryType;
      if (!acc[t]) acc[t] = [];
      acc[t].push({ entry, idx });
      return acc;
    },
    {},
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-1">Prévisualiser et choisir ce à importer</h2>
      <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)] mb-5">
        {profileChanges > 0 && `${profileChanges} champ(s) de profil · `}
        {selectedCount} entrée(s) sélectionnée(s) sur {selectableEntries.length}
      </p>

      {/* Profile diffs */}
      {profileDiffs.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--pc-muted)] uppercase tracking-wide mb-3">
            Informations personnelles
          </h3>
          <div className="rounded-xl border border-gray-200 dark:border-[var(--pc-border)] overflow-hidden divide-y divide-gray-100 dark:divide-[var(--pc-border)]">
            {profileDiffs.map(diff => (
              <div key={diff.key} className="flex items-start gap-3 px-4 py-3 bg-white dark:bg-[var(--pc-card)]">
                <input
                  type="checkbox"
                  id={`diff-${diff.key}`}
                  checked={diff.useImported}
                  onChange={() => toggleProfileField(diff.key)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-[var(--pc-border)] text-lagon-600 flex-shrink-0"
                />
                <label htmlFor={`diff-${diff.key}`} className="flex-1 cursor-pointer min-w-0">
                  <span className="block text-xs font-medium text-gray-500 dark:text-[var(--pc-muted)] mb-0.5">{diff.label}</span>
                  <div className="flex flex-col gap-1">
                    {diff.existing && (
                      <span className="text-xs text-gray-400 dark:text-[var(--pc-muted)] line-through truncate">{diff.existing}</span>
                    )}
                    <span className={`text-sm truncate ${diff.useImported ? 'text-green-700 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-[var(--pc-muted)]'}`}>
                      {diff.imported}
                    </span>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Entries by type */}
      {Object.entries(entriesByType).map(([type, items]) => {
        const allSelected = items.every(({ entry }) => entry.selected);
        const noneSelected = items.every(({ entry }) => !entry.selected);
        return (
          <section key={type} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-[var(--pc-muted)] uppercase tracking-wide">
                {ENTRY_TYPE_LABELS[type] ?? type} ({items.length})
              </h3>
              <div className="flex gap-2">
                {!allSelected && (
                  <button onClick={() => toggleAllEntries(type, true)} className="text-xs text-lagon-600 hover:underline dark:text-lagon-400">
                    Tout sélectionner
                  </button>
                )}
                {!noneSelected && (
                  <button onClick={() => toggleAllEntries(type, false)} className="text-xs text-gray-500 hover:underline dark:text-[var(--pc-muted)]">
                    Tout désélectionner
                  </button>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-[var(--pc-border)] overflow-hidden divide-y divide-gray-100 dark:divide-[var(--pc-border)]">
              {items.map(({ entry, idx }) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    entry.selected ? 'bg-white dark:bg-[var(--pc-card)]' : 'bg-gray-50 dark:bg-[var(--pc-card)]/50 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    id={`entry-${idx}`}
                    checked={entry.selected}
                    onChange={() => toggleEntry(idx)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-[var(--pc-border)] text-lagon-600 flex-shrink-0"
                  />
                  <label htmlFor={`entry-${idx}`} className="flex-1 cursor-pointer min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 dark:text-[var(--pc-text)] truncate">{entry.data.title}</span>
                      {entry.data.subtitle && (
                        <span className="text-xs text-gray-500 dark:text-[var(--pc-muted)] truncate">{entry.data.subtitle}</span>
                      )}
                      {entry.possibleDuplicate && (
                        <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          Doublon possible
                        </span>
                      )}
                    </div>
                    {(entry.data.startDate || entry.data.location) && (
                      <span className="text-xs text-gray-400 dark:text-[var(--pc-muted)]">
                        {[entry.data.startDate, entry.data.endDate ? `→ ${entry.data.endDate}` : entry.data.isCurrent ? '→ Aujourd\'hui' : '', entry.data.location].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {entry.data.description && (
                      <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mt-0.5 line-clamp-2">{entry.data.description}</p>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {profileDiffs.length === 0 && selectableEntries.length === 0 && (
        <div className="text-center py-10 text-gray-400 dark:text-[var(--pc-muted)]">
          <p className="text-sm">Aucune donnée à importer.</p>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <Button
          onClick={() => onConfirm(profileDiffs, selectableEntries)}
          disabled={profileChanges === 0 && selectedCount === 0}
        >
          Importer ({profileChanges + selectedCount} élément{profileChanges + selectedCount > 1 ? 's' : ''})
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Done
// ─────────────────────────────────────────────────────────────────────────────

function StepDone({ profileCount, entryCount, onGoToProfile }: { profileCount: number; entryCount: number; onGoToProfile: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
        <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-[var(--pc-text)] mb-2">Import terminé !</h2>
      <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)] mb-6">
        {profileCount > 0 && `${profileCount} champ(s) de profil mis à jour · `}
        {entryCount} entrée(s) ajoutée(s) à votre profil.
      </p>
      <Button onClick={onGoToProfile}>
        Voir mon profil
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ImportPage
// ─────────────────────────────────────────────────────────────────────────────

export function ImportPage() {
  const navigate = useNavigate();
  const { profile: currentProfile, updateProfile, addEntry, fetchProfile } = useProfileStore();

  const [step, setStep] = useState<StepId>('source');
  const [format, setFormat] = useState<ImportFormat | null>(null);
  const [rawText, setRawText] = useState<string | undefined>();
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [importResult, setImportResult] = useState({ profileCount: 0, entryCount: 0 });
  const [importing, setImporting] = useState(false);

  // Source → next step
  const handleSourceNext = (fmt: ImportFormat, parsedPayload: ImportPayload | null, text?: string) => {
    setFormat(fmt);
    setRawText(text);

    if (parsedPayload) {
      // LinkedIn: skip process step, go straight to preview
      setPayload(parsedPayload);
      setStep('preview');
    } else {
      // PDF/DOCX/JSON: go to process step
      setStep('process');
    }
  };

  // Process → preview
  const handleProcessNext = (parsedPayload: ImportPayload) => {
    setPayload(parsedPayload);
    setStep('preview');
  };

  // Preview → done (apply import)
  const handleConfirm = async (diffs: ProfileFieldDiff[], entries: SelectableEntry[]) => {
    setImporting(true);
    try {
      const result = await applyImport(diffs, entries, {
        updateProfile,
        addEntry,
        fetchProfile,
        getProfileId: () => useProfileStore.getState().profile?.id ?? currentProfile?.id ?? '',
      });
      setImportResult(result);
      setStep('done');
      toast.success(`Import réussi — ${result.entryCount} entrée(s) ajoutée(s)`);
    } catch (e) {
      toast.error(`Erreur lors de l'import : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-[var(--pc-muted)] hover:text-gray-700 dark:hover:text-[var(--pc-text)] transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au profil
        </button>
        <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-gray-900 dark:text-[var(--pc-text)]">Importer mon CV</h1><HelpButton id="importer" /></div>
        <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)] mt-1">
          Récupérez les informations de votre CV (PDF ou Word) ou de votre export LinkedIn.
        </p>
      </div>

      <div className="bg-white dark:bg-[var(--pc-card)] rounded-2xl shadow-sm border border-gray-200 dark:border-[var(--pc-border)] p-6">
        <StepBar current={step} />

        {step === 'source' && <StepSource onNext={handleSourceNext} onManual={() => navigate('/profile')} />}

        {step === 'process' && format && (
          <StepProcess
            format={format}
            rawText={rawText}
            onNext={handleProcessNext}
            onBack={() => setStep('source')}
            onManual={() => navigate('/profile')}
          />
        )}

        {step === 'preview' && payload && (
          importing ? (
            <div className="text-center py-10 text-gray-500 dark:text-[var(--pc-muted)]">
              <p className="text-sm">Import en cours...</p>
            </div>
          ) : (
            <StepPreview
              payload={payload}
              onConfirm={handleConfirm}
              onBack={() => setStep(format === 'linkedin' ? 'source' : 'process')}
            />
          )
        )}

        {step === 'done' && (
          <StepDone
            profileCount={importResult.profileCount}
            entryCount={importResult.entryCount}
            onGoToProfile={() => navigate('/profile')}
          />
        )}
      </div>
    </div>
  );
}
