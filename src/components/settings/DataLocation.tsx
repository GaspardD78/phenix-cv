import { useEffect, useState } from 'react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { FolderOpen, HardDrive } from 'lucide-react';
import { UNKNOWN_APP_MODE, describeAppMode, getAppMode, type AppMode } from '@/lib/app-mode';

const TONES = {
  portable: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  installed: 'border-gray-200 bg-gray-50 text-gray-700 dark:bg-[var(--pc-bg)] dark:text-[var(--pc-muted)] dark:border-[var(--pc-border)]',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
} as const;

/** Où sont les données : version portable (clé USB) ou ordinateur. Rien n'est affiché hors de l'application. */
export function DataLocation() {
  const [mode, setMode] = useState<AppMode>(UNKNOWN_APP_MODE);
  useEffect(() => { void getAppMode().then(setMode); }, []);
  const text = describeAppMode(mode);
  if (!text) return null;
  return (
    <div className={`rounded-xl border p-4 mb-6 text-sm space-y-1.5 ${TONES[text.tone]}`} data-testid="data-location" data-tone={text.tone}>
      <p className="font-semibold flex items-center gap-2"><HardDrive size={16} aria-hidden /> {text.title}</p>
      {text.lines.map((l, i) => <p key={i}>{l}</p>)}
      {mode.dataDir && (
        <p className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs break-all">{mode.dataDir}</span>
          <button type="button" className="inline-flex items-center gap-1 text-xs underline" onClick={() => { void revealItemInDir(mode.dataDir!).catch(() => {}); }}>
            <FolderOpen size={14} aria-hidden /> Ouvrir le dossier
          </button>
        </p>
      )}
    </div>
  );
}
