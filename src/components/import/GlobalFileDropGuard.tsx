import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileUp } from 'lucide-react';
import { isTauri } from '@/lib/platform';
import { classifyDroppedPaths } from '@/lib/import/file-kind';
import { useImportDropStore } from '@/stores/importDropStore';

/**
 * Garde globale des fichiers glissés dans la fenêtre :
 * - jamais de fichier ouvert « tout seul » par la fenêtre (les événements HTML natifs sont neutralisés) ;
 * - un CV déposé sur l'écran d'import est lu aussitôt ; ailleurs, un message propose de l'importer ;
 * - un fichier non pris en charge reçoit un message clair.
 */
export function GlobalFileDropGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const dragging = useImportDropStore(s => s.dragging);
  const onImportPage = location.pathname === '/import';

  // Neutralise l'ouverture d'un fichier par la fenêtre (navigateur ou WebView).
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  // Événements de dépôt natifs de Tauri (chemins réels des fichiers).
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const stop = await getCurrentWebview().onDragDropEvent((event) => {
          const { setDragging, setPending } = useImportDropStore.getState();
          const payload = event.payload;
          if (payload.type === 'enter') setDragging(true);
          else if (payload.type === 'leave') setDragging(false);
          else if (payload.type === 'drop') {
            setDragging(false);
            const result = classifyDroppedPaths(payload.paths);
            if (!result.ok) {
              toast.error(result.message, { duration: 8000 });
              return;
            }
            const file = { path: result.path, format: result.format, name: result.name };
            if (window.location.pathname === '/import') {
              setPending(file);
            } else {
              toast(`Importer « ${result.name} » dans votre profil ?`, {
                duration: 15000,
                action: { label: 'Importer', onClick: () => { setPending(file); navigate('/import'); } },
              });
            }
          }
        });
        if (cancelled) stop();
        else unlisten = stop;
      } catch {
        /* hors application : rien à écouter */
      }
    })();
    return () => { cancelled = true; unlisten?.(); };
  }, [navigate]);

  if (!dragging || onImportPage) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-lagon-600/10 backdrop-blur-[1px] pointer-events-none">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-lagon-500 bg-white dark:bg-[var(--pc-bg)] px-10 py-8 shadow-xl">
        <FileUp className="w-8 h-8 text-lagon-600" />
        <p className="text-base font-semibold text-gray-900 dark:text-[var(--pc-text)]">Relâchez pour importer votre CV</p>
        <p className="text-sm text-gray-500 dark:text-[var(--pc-muted)]">PDF, Word (.docx) ou export LinkedIn (.zip)</p>
      </div>
    </div>
  );
}
