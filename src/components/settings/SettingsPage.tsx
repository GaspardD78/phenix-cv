import { useState, useEffect } from 'react';
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, Sparkles, Sun, Moon, Monitor, FileText, ClipboardList } from 'lucide-react';
import { MODULES, ModuleId, BackupData, exportBackup, pickAndParseBackup } from '@/lib/backup';
import { ImportConflictModal } from './ImportConflictModal';
import { GoogleDriveSync } from './GoogleDriveSync';
import { AdvancedOptions } from './AdvancedOptions';
import { SETTINGS_TREE, resolveSettingsPage } from './settings-tree';
import { CvAnglesSettings } from './CvAnglesSettings';
import { TargetSheetsSettings } from './TargetSheetsSettings';
import { BulletFocusSelect } from '@/components/cv-builder/BulletFocusSelect';
import { VerbTenseSelect } from '@/components/cv-builder/VerbTenseSelect';
import { resolveVerbTense } from '@/lib/cv-focus-rules';
import { usePromptStore } from '@/stores/promptStore';
import { useProfileStore } from '@/stores/profileStore';
import { PERSONAL_RULES_TEMPLATE } from '@/lib/cv-prompt';
import { useTheme } from '@/hooks/useTheme';

const PAGE_KEY = 'phenixcv_settings_page';

function SettingsPane({ id, active, children }: { id: string; active: string; children: React.ReactNode }) {
  return <div hidden={id !== active} data-settings-page={id}>{children}</div>;
}

export function SettingsPage() {
  const [page, setPage] = useState(() => {
    try { return resolveSettingsPage(localStorage.getItem(PAGE_KEY)); } catch { return resolveSettingsPage(null); }
  });
  const choosePage = (id: string) => {
    setPage(id);
    try { localStorage.setItem(PAGE_KEY, id); } catch { /* facultatif */ }
  };

  // ── AI Differentiator ───────────────────────────────────────────────────
  const { differentiator, loadDifferentiator, saveDifferentiator, isLoaded, targetPages, loadTargetPages, saveTargetPages } = usePromptStore();
  const [localDifferentiator, setLocalDifferentiator] = useState('');
  const [diffSaved, setDiffSaved] = useState(false);

  useEffect(() => {
    if (!isLoaded) loadDifferentiator();
  }, [isLoaded, loadDifferentiator]);

  useEffect(() => {
    loadTargetPages();
  }, [loadTargetPages]);

  useEffect(() => {
    if (isLoaded) setLocalDifferentiator(differentiator);
  }, [isLoaded, differentiator]);

  const handleSaveDifferentiator = async () => {
    await saveDifferentiator(localDifferentiator);
    setDiffSaved(true);
    setTimeout(() => setDiffSaved(false), 2000);
  };

  // ── Règles personnelles (par profil) ──────────────────────────────────────
  const { profile } = useProfileStore();
  const { personalRules, personalRulesProfileId, loadPersonalRules, savePersonalRules, bulletFocus, bulletFocusProfileId, loadBulletFocus, saveBulletFocus, verbTense, verbTenseProfileId, loadVerbTense, saveVerbTense } = usePromptStore();
  const [localRules, setLocalRules] = useState('');
  const [rulesSaved, setRulesSaved] = useState(false);

  useEffect(() => {
    if (profile) { loadPersonalRules(profile.id); loadBulletFocus(profile.id); loadVerbTense(profile.id); }
  }, [profile?.id, loadPersonalRules, loadBulletFocus, loadVerbTense]);

  useEffect(() => {
    if (profile && personalRulesProfileId === profile.id) setLocalRules(personalRules);
  }, [profile?.id, personalRules, personalRulesProfileId]);

  const handleSaveRules = async () => {
    if (!profile) return;
    await savePersonalRules(profile.id, localRules);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2000);
  };

  // ── Theme ───────────────────────────────────────────────────────────────
  const { theme, setTheme } = useTheme();

  // ── Export state ──────────────────────────────────────────────────────────
  const [selectedModules, setSelectedModules] = useState<Set<ModuleId>>(
    new Set(MODULES.map(m => m.id))
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Import state ──────────────────────────────────────────────────────────
  const [isParsing, setIsParsing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);

  // ── Module toggle ─────────────────────────────────────────────────────────
  const toggleModule = (id: ModuleId) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedModules.size === MODULES.length) setSelectedModules(new Set());
    else setSelectedModules(new Set(MODULES.map(m => m.id)));
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (selectedModules.size === 0) return;
    setIsExporting(true);
    setExportStatus(null);
    try {
      await exportBackup([...selectedModules]);
      setExportStatus({ ok: true, message: 'Sauvegarde exportée avec succès.' });
    } catch (err) {
      setExportStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'Erreur lors de l\'export.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────
  const handlePickFile = async () => {
    setIsParsing(true);
    setImportError(null);
    try {
      const backup = await pickAndParseBackup();
      if (backup) setPendingBackup(backup);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Impossible de lire le fichier.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
     <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1 dark:text-[var(--pc-text)]">Paramètres</h1>
      <p className="text-gray-500 dark:text-[var(--pc-muted)] text-sm mb-6">Choisissez une rubrique dans le sommaire.</p>
      <div className="flex flex-col md:flex-row gap-6 items-start">
      <nav aria-label="Sommaire des paramètres" className="md:w-56 md:flex-shrink-0 md:sticky md:top-0 w-full">
{SETTINGS_TREE.map(group => (
          <div key={group.label} className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-[var(--pc-muted)] px-2 mb-1">{group.label}</p>
            <ul>
              {group.pages.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => choosePage(p.id)}
                    aria-current={page === p.id ? 'page' : undefined}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                      page === p.id ? 'bg-lagon-50 text-lagon-700 font-medium dark:bg-[var(--pc-accent-subtle)] dark:text-[var(--pc-accent)]' : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
            {(group.subgroups ?? []).map(sg => (
              <div key={sg.label} className="mt-2">
                <p className="text-xs font-medium text-gray-500 dark:text-[var(--pc-muted)] px-2 mb-0.5 italic">{sg.label}</p>
                <ul>
                  {sg.pages.map(p => (
                    <li key={p.id}>
                  <button
                    onClick={() => choosePage(p.id)}
                    aria-current={page === p.id ? 'page' : undefined}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                      page === p.id ? 'bg-lagon-50 text-lagon-700 font-medium dark:bg-[var(--pc-accent-subtle)] dark:text-[var(--pc-accent)]' : 'opacity-80 hover:opacity-100 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex-1 min-w-0 w-full">

      <SettingsPane id="apparence" active={page}>
      {/* ── Apparence ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Sun size={18} className="text-yellow-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Apparence</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Choisissez le thème de l'application.
          </p>
        </div>
        <div className="p-6">
          <div className="flex gap-3">
            {([
              { value: 'light' as const, label: 'Clair', icon: Sun },
              { value: 'dark' as const, label: 'Sombre', icon: Moon },
              { value: 'system' as const, label: 'Système', icon: Monitor },
            ]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  theme === value
                    ? 'bg-lagon-50 dark:bg-lagon-900/30 border-lagon-300 dark:border-lagon-600 text-lagon-700 dark:text-lagon-300'
                    : 'bg-white dark:bg-[var(--pc-surface)] border-gray-200 dark:border-[var(--pc-border-active)] text-gray-700 dark:text-[var(--pc-muted)] hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      </SettingsPane>

      <SettingsPane id="ia-personnalisation" active={page}>
      {/* ── AI Prompt Personalization ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-amber-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Personnalisation des prompts IA</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Ces paramètres sont utilisés par le générateur de prompts dans le CV builder.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--pc-text)] mb-1">
              Votre atout différenciant
            </label>
            <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)] mb-2">
              Décrivez en une phrase ce qui vous distingue des autres personnes qui postulent.
              Ce texte sera injecté dans les prompts d'entretien et de message de candidature.
            </p>
            <textarea
              value={localDifferentiator}
              onChange={e => setLocalDifferentiator(e.target.value)}
              placeholder={"Ex. : Une certification, une réalisation ou une spécialité qui vous distingue"}
              className="w-full p-2.5 border border-gray-300 dark:border-[var(--pc-border)] rounded-md text-sm resize-y h-20 focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </div>

          <button
            onClick={handleSaveDifferentiator}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors ${
              diffSaved
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
          >
            {diffSaved ? (
              <><CheckCircle2 size={15} /> Enregistré</>
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </section>
      </SettingsPane>

      <SettingsPane id="ia-longueur" active={page}>
      {/* ── Pages cibles du CV généré par IA ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={18} className="text-lagon-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Pages cibles</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Nombre de pages visé par le CV généré par IA. À 1 page (défaut), le prompt impose une accroche de 3 lignes,
            3 puces pour les expériences des 5 dernières années, 2 de 5 à 10 ans, une ligne au-delà, 3 à 5 catégories
            et 12 à 15 éléments de compétences, et le contrôle signale tout dépassement probable.
          </p>
        </div>
        <div className="p-6 flex gap-3" role="radiogroup" aria-label="Pages cibles">
          {([1, 2] as const).map(n => (
            <button
              key={n}
              role="radio"
              aria-checked={targetPages === n}
              onClick={() => saveTargetPages(n)}
              className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                targetPages === n
                  ? 'bg-lagon-50 dark:bg-lagon-900/30 border-lagon-300 dark:border-lagon-600 text-lagon-700 dark:text-lagon-300'
                  : 'bg-white dark:bg-[var(--pc-surface)] border-gray-200 dark:border-[var(--pc-border-active)] text-gray-700 dark:text-[var(--pc-muted)] hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              {n} page{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </section>
      </SettingsPane>

      <SettingsPane id="ia-regles" active={page}>
      {/* ── Règles personnelles du candidat (prompt « CV ciblé ») ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList size={18} className="text-lagon-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Règles personnelles</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Propres au profil {profile ? `« ${profile.firstName} ${profile.lastName} »` : 'actif'}. Injectées dans le prompt du CV ciblé
            avant les règles de rédaction, en priorité absolue sur l'annonce : faits à respecter, style, critères de recherche.
            Laisser vide pour ne rien ajouter.
          </p>
        </div>
        <div className="p-6 space-y-3">
          <textarea
            value={localRules}
            onChange={e => setLocalRules(e.target.value)}
            disabled={!profile}
            aria-label="Règles personnelles"
            placeholder="Faits à respecter, style, critères de recherche…"
            className="w-full p-2.5 border border-gray-300 dark:border-[var(--pc-border-active)] dark:bg-[var(--pc-surface)] dark:text-[var(--pc-text)] rounded-md text-sm font-mono resize-y h-56 focus:ring-2 focus:ring-lagon-200 focus:border-lagon-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveRules}
              disabled={!profile}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md transition-colors disabled:opacity-50 ${
                rulesSaved ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-lagon-600 text-white hover:bg-lagon-700'
              }`}
            >
              {rulesSaved ? <><CheckCircle2 size={15} /> Enregistré</> : 'Enregistrer'}
            </button>
            {!localRules.trim() && (
              <button
                onClick={() => setLocalRules(PERSONAL_RULES_TEMPLATE)}
                disabled={!profile}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-[var(--pc-border-active)] text-gray-700 dark:text-[var(--pc-muted)] hover:bg-gray-50 dark:hover:bg-[var(--pc-hover)] disabled:opacity-50"
              >
                Insérer un modèle
              </button>
            )}
          </div>
        </div>
      </section>
      </SettingsPane>

      <SettingsPane id="ia-style" active={page}>
      {/* ── Orientation des puces (par profil) ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Orientation du CV</h2>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Ce que les puces mettent en avant par défaut. Modifiable pour chaque CV dans « Paramètres de ce CV ».
          </p>
        </div>
        <div className="p-6">
          <BulletFocusSelect
            id="bullet-focus"
            value={profile && bulletFocusProfileId === profile.id ? (bulletFocus ?? 'missions') : 'missions'}
            onChange={v => { if (profile && v) void saveBulletFocus(profile.id, v); }}
          />
          <div className="mt-4">
            <label htmlFor="verb-tense" className="block text-sm font-medium dark:text-[var(--pc-text)] mb-1">Début des puces</label>
            <VerbTenseSelect
              id="verb-tense"
              value={profile && verbTenseProfileId === profile.id ? resolveVerbTense(verbTense) : resolveVerbTense(undefined)}
              onChange={v => { if (profile) void saveVerbTense(profile.id, v); }}
            />
          </div>
        </div>
      </section>
      </SettingsPane>

      {/* ── Angles de CV (bibliothèque + matrice d'affinité) ── */}
      <SettingsPane id="ia-mises-en-avant" active={page}>
        <CvAnglesSettings />
      </SettingsPane>

      {/* ── Fiches de ciblage (type de structure) ── */}
      <SettingsPane id="ia-employeurs" active={page}>
        <TargetSheetsSettings />
      </SettingsPane>

      {/* ── Google Drive Sync ── */}
      <SettingsPane id="drive" active={page}>
        <GoogleDriveSync />
      </SettingsPane>

      <SettingsPane id="sauvegarde" active={page}>
      {/* ── Backup section ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Download size={18} className="text-lagon-600" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Sauvegarde des données</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Exporte vos données dans un fichier <code className="bg-gray-100 px-1 rounded text-xs">.cvmaker</code> que vous pouvez stocker ou transférer sur une autre installation.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Module checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-[var(--pc-text)]">Modules à inclure</p>
              <button
                onClick={toggleAll}
                className="text-xs text-lagon-600 hover:underline"
              >
                {selectedModules.size === MODULES.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
            <div className="space-y-2">
              {MODULES.map(m => (
                <label
                  key={m.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-[var(--pc-border)] cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedModules.has(m.id)}
                    onChange={() => toggleModule(m.id)}
                    className="mt-0.5 w-4 h-4 rounded accent-lagon-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-[var(--pc-text)]">{m.label}</p>
                    <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)]">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Export feedback */}
          {exportStatus && (
            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
              exportStatus.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {exportStatus.ok
                ? <CheckCircle2 size={15} />
                : <AlertCircle size={15} />}
              {exportStatus.message}
            </div>
          )}

          <button
            onClick={handleExport}
            disabled={isExporting || selectedModules.size === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-lagon-600 text-white text-sm rounded-md hover:bg-lagon-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting
              ? <><Loader2 size={15} className="animate-spin" /> Export en cours…</>
              : <><Download size={15} /> Télécharger la sauvegarde</>}
          </button>
        </div>
      </section>
      </SettingsPane>

      <SettingsPane id="restauration" active={page}>
      {/* ── Restore section ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <div className="flex items-center gap-2 mb-1">
            <Upload size={18} className="text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Restauration des données</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
            Importez un fichier <code className="bg-gray-100 px-1 rounded text-xs">.cvmaker</code> pour restaurer ou fusionner des données.
            Vous pourrez choisir la stratégie module par module.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              Certaines stratégies d'import peuvent écraser vos données actuelles de façon irréversible.
              Pensez à faire une sauvegarde avant d'importer.
            </span>
          </div>

          {importError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              <AlertCircle size={15} className="flex-shrink-0" />
              {importError}
            </div>
          )}

          <button
            onClick={handlePickFile}
            disabled={isParsing}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-[var(--pc-border)] text-gray-700 dark:text-[var(--pc-text)] text-sm rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isParsing
              ? <><Loader2 size={15} className="animate-spin" /> Lecture du fichier…</>
              : <><Upload size={15} /> Choisir un fichier .cvmaker</>}
          </button>
        </div>
      </section>
      </SettingsPane>

      <SettingsPane id="avance" active={page}>
        <AdvancedOptions />
      </SettingsPane>

      <SettingsPane id="a-propos" active={page}>
      {/* ── À propos ── */}
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mt-6 mb-12">
        <div className="p-6 border-b dark:border-[var(--pc-border)]">
          <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">À propos</h2>
          <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">Phénix CV vous aide à créer un CV clair, de votre profil jusqu'à l'export.</p>
        </div>
        <div className="p-6 text-sm text-gray-600 dark:text-[var(--pc-muted)] space-y-2">
          <p>Vos données restent sur votre ordinateur.</p>
          <p>
            Copyright © 2026 Gaspard Douté. Phénix CV est un logiciel libre, distribué sous licence{' '}
            <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer" className="underline">
              GNU GPL version 3
            </a>
            . Il est fourni sans aucune garantie.
          </p>
        </div>
      </section>
      </SettingsPane>

      </div>
      </div>
     </div>
      {/* Conflict resolution modal */}
      {pendingBackup && (
        <ImportConflictModal
          backup={pendingBackup}
          onClose={() => setPendingBackup(null)}
          onDone={() => setPendingBackup(null)}
        />
      )}
    </div>
  );
}
