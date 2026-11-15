import { useState, useEffect, useCallback } from 'react';
import {
  Cloud, CloudOff, Upload, Download, Loader2, CheckCircle2,
  AlertCircle, Unlink,
} from 'lucide-react';
import { toast } from 'sonner';
import { confirm as tauriConfirm } from '@tauri-apps/plugin-dialog';
import {
  startOAuthFlow, waitForOAuthCallback, exchangeCode,
  isConnected, clearTokens, isDriveConfigured, listDriveBackups, uploadToDrive, downloadFromDrive,
  type DriveFile,
} from '@/lib/gdrive';
import { buildBackupData, importBackup, redactTargetPeople, MODULES, BackupProfileChoiceRequired, type BackupData, type ImportPlan } from '@/lib/backup';
import { ImportConflictModal } from './ImportConflictModal';
import { CUSTOM_CLIENT_ID_KEY, CUSTOM_CLIENT_SECRET_KEY } from '@/lib/gdrive-config';
import { getSetting, setSetting } from '@/lib/db';
import { useSessionStore } from '@/stores/sessionStore';

export function GoogleDriveSync() {
  const profileId = useSessionStore(s => s.currentUserId);
  // null = vérification en cours ; false = aucun identifiant (synchronisation désactivée).
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [working, setWorking] = useState<'connect' | 'upload' | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Sauvegarde à plusieurs profils sans correspondance : choix du profil dans l'écran d'import.
  const [pendingBackup, setPendingBackup] = useState<BackupData | null>(null);

  const refreshConfigured = useCallback(async () => {
    setConfigured(await isDriveConfigured());
  }, []);

  useEffect(() => { void refreshConfigured(); }, [refreshConfigured]);

  const checkConnection = useCallback(async () => {
    setConnected(await isConnected(profileId));
  }, [profileId]);

  const fetchFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      setFiles(await listDriveBackups(profileId));
    } catch {
      setConnected(false);
    } finally {
      setLoadingFiles(false);
    }
  }, [profileId]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (connected) fetchFiles();
  }, [connected, fetchFiles]);

  const handleConnect = async () => {
    if (working) return;
    setWorking('connect');
    setStatus(null);
    try {
      await startOAuthFlow();
      const code = await waitForOAuthCallback();
      if (!code) throw new Error('Authentification annulée ou délai dépassé.');
      await exchangeCode(code, profileId);
      await checkConnection();
      await fetchFiles();
      setStatus({ ok: true, message: 'Connecté à Google Drive !' });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : 'Erreur de connexion.' });
    } finally {
      setWorking(null);
    }
  };

  const handleDisconnect = async () => {
    await clearTokens(profileId);
    setConnected(false);
    setFiles([]);
    setStatus({ ok: true, message: 'Déconnecté de Google Drive.' });
  };

  const handleUpload = async () => {
    if (working) return;
    setWorking('upload');
    setStatus(null);
    try {
      // Les noms du ciblage (lecteur, personne qui transmet le CV) ne quittent pas l'appareil.
      const backup = redactTargetPeople(await buildBackupData(MODULES.map(m => m.id)));
      const json = JSON.stringify(backup, null, 2);
      const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
      await uploadToDrive(json, `phenixcv_sauvegarde_${date}.cvmaker`, profileId);
      await fetchFiles();
      setStatus({ ok: true, message: 'Sauvegarde envoyée vers Google Drive.' });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : "Échec de l'envoi." });
    } finally {
      setWorking(null);
    }
  };

  const handleDownload = async (file: DriveFile) => {
    if (downloadingId) return;

    let confirmed = false;
    try {
      confirmed = await tauriConfirm(
        `Restaurer "${file.name}" ? Les données existantes seront fusionnées.`,
        { title: 'Restaurer depuis Google Drive', kind: 'warning' }
      );
    } catch {
      confirmed = window.confirm(`Restaurer "${file.name}" ?`);
    }
    if (!confirmed) return;

    setDownloadingId(file.id);
    let backup: BackupData | null = null;
    try {
      const raw = await downloadFromDrive(file.id, profileId);
      backup = JSON.parse(raw) as BackupData;
      if (!backup.__cvmaker_backup) throw new Error('Fichier invalide.');
      const plan: ImportPlan = Object.fromEntries(MODULES.map(m => [m.id, 'merge'])) as ImportPlan;
      await importBackup(backup, plan);
      toast.success(`Données restaurées depuis "${file.name}"`);
    } catch (e) {
      if (e instanceof BackupProfileChoiceRequired && backup) {
        toast.info(e.message);
        setPendingBackup(backup);
        return;
      }
      toast.error(e instanceof Error ? e.message : 'Échec de la restauration.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (configured !== true) {
    return (
      <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
        <div className={`p-6 ${configured === false ? 'opacity-70' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <CloudOff size={18} className="text-gray-400 dark:text-[var(--pc-muted)]" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Synchronisation Google Drive</h2>
          </div>
          {configured === false && (
            <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
              La synchronisation Google Drive n'est pas activée dans cette version. Vos données restent sur cet ordinateur.
              Vous pouvez toujours enregistrer un fichier de sauvegarde (.cvmaker) avec la section « Sauvegarde » ci-dessus.
            </p>
          )}
        </div>
        {configured === false && <DriveAdvancedOptions onSaved={refreshConfigured} />}
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-[var(--pc-card)] rounded-xl border border-gray-200 dark:border-[var(--pc-border)] shadow-sm mb-6">
      <div className="p-6 border-b dark:border-[var(--pc-border)]">
        <div className="flex items-center gap-2 mb-1">
          <Cloud size={18} className="text-lagon-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Synchronisation Google Drive</h2>
        </div>
        <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">
          Sauvegardez et synchronisez vos données entre PC et mobile via Google Drive.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Status feedback */}
        {status && (
          <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${
            status.ok
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          }`}>
            {status.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {status.message}
          </div>
        )}

        {/* Connect / Disconnect */}
        {!connected ? (
          <div className="space-y-2">
            <button
              onClick={handleConnect}
              disabled={working === 'connect'}
              className="flex items-center gap-2 px-4 py-2.5 bg-lagon-600 text-white text-sm rounded-md hover:bg-lagon-700 disabled:opacity-50 transition-colors"
            >
              {working === 'connect'
                ? <><Loader2 size={15} className="animate-spin" /> Connexion en cours…</>
                : <><Cloud size={15} /> Se connecter à Google Drive</>}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                <CheckCircle2 size={15} /> Connecté à Google Drive
              </span>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-[var(--pc-muted)] hover:text-red-500 transition-colors"
              >
                <Unlink size={12} /> Déconnecter
              </button>
            </div>

            <button
              onClick={handleUpload}
              disabled={!!working}
              className="flex items-center gap-2 px-4 py-2 bg-lagon-600 text-white text-sm rounded-md hover:bg-lagon-700 disabled:opacity-50 transition-colors"
            >
              {working === 'upload'
                ? <><Loader2 size={14} className="animate-spin" /> Envoi en cours…</>
                : <><Upload size={14} /> Sauvegarder vers Drive</>}
            </button>

            {/* Backup list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-[var(--pc-muted)]">
                  Sauvegardes dans Drive
                </p>
                <button
                  onClick={() => fetchFiles()}
                  className="text-xs text-lagon-600 hover:underline"
                >
                  Actualiser
                </button>
              </div>

              {loadingFiles ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[var(--pc-muted)] py-2">
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              ) : files.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-[var(--pc-muted)] py-4">
                  <CloudOff size={16} /> Aucune sauvegarde dans Drive.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {files.map(f => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-[var(--pc-surface)]/50 rounded-lg border border-gray-100 dark:border-[var(--pc-border)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-[var(--pc-text)] truncate">{f.name}</p>
                        <p className="text-xs text-gray-400 dark:text-[var(--pc-muted)]">
                          {new Date(f.modifiedTime).toLocaleString('fr-FR')}
                          {f.size && ` · ${Math.round(Number(f.size) / 1024)} Ko`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownload(f)}
                        disabled={!!downloadingId}
                        title="Restaurer cette sauvegarde"
                        className="ml-3 flex items-center gap-1 text-xs text-lagon-600 hover:text-lagon-800 dark:hover:text-lagon-400 font-medium px-2 py-1 rounded hover:bg-lagon-50 dark:hover:bg-lagon-900/30 disabled:opacity-50 transition-colors shrink-0"
                      >
                        {downloadingId === f.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Download size={12} />}
                        Restaurer
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
      {pendingBackup && (
        <ImportConflictModal
          backup={pendingBackup}
          onClose={() => setPendingBackup(null)}
          onDone={() => setPendingBackup(null)}
        />
      )}
    </section>
  );
}

/** Saisie manuelle des identifiants OAuth, réservée aux utilisateurs avancés. */
function DriveAdvancedOptions({ onSaved }: { onSaved: () => void | Promise<void> }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setClientId((await getSetting(CUSTOM_CLIENT_ID_KEY)) ?? '');
      setClientSecret((await getSetting(CUSTOM_CLIENT_SECRET_KEY)) ?? '');
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setSetting(CUSTOM_CLIENT_ID_KEY, clientId.trim());
      await setSetting(CUSTOM_CLIENT_SECRET_KEY, clientSecret.trim());
      await onSaved();
      toast.success(clientId.trim() ? 'Identifiants enregistrés.' : 'Identifiants effacés.');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-[var(--pc-border-active)] rounded-md bg-white dark:bg-[var(--pc-bg)]';
  return (
    <details className="border-t dark:border-[var(--pc-border)] px-6 py-4">
      <summary className="text-sm font-medium cursor-pointer text-gray-600 dark:text-[var(--pc-muted)]">Options avancées</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-gray-500 dark:text-[var(--pc-muted)]">
          Vous avez créé votre propre client OAuth Google (type « Application de bureau ») ? Saisissez-le ici pour activer la synchronisation.
        </p>
        <input className={field} placeholder="Identifiant client (se termine par .apps.googleusercontent.com)" value={clientId} onChange={e => setClientId(e.target.value)} />
        <input className={field} placeholder="Secret client (facultatif)" type="password" value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-lagon-600 text-white text-sm rounded-md hover:bg-lagon-700 disabled:opacity-50">
          Enregistrer
        </button>
      </div>
    </details>
  );
}
