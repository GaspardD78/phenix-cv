import { ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { toast } from 'sonner';

/** Assistants IA proposés partout où l'application prépare un texte à copier. */
export const AI_SITES = [
  { label: 'Ouvrir ChatGPT', url: 'https://chatgpt.com/' },
  { label: 'Ouvrir Claude', url: 'https://claude.ai/new' },
  { label: 'Ouvrir Gemini', url: 'https://gemini.google.com/app' },
] as const;

export async function openAiSite(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch {
    toast.error(`Impossible d'ouvrir le site. Ouvrez votre navigateur et allez sur ${url}`);
  }
}

/**
 * Encadré « Pas encore d'IA ? » : explication courte et accès direct aux assistants.
 * Affiché sous l'action principale « avec l'IA », au-dessus de l'option sans IA.
 */
export function AiSiteLinks({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-md border border-gray-200 dark:border-[var(--pc-border)] bg-gray-50 dark:bg-[var(--pc-bg)] p-2.5 ${className}`} data-testid="ai-site-links">
      <p className="text-xs text-gray-600 dark:text-[var(--pc-muted)]">
        <span className="font-semibold text-gray-700 dark:text-[var(--pc-text)]">Pas encore d'IA ?</span>{' '}
        Ouvrez celle de votre choix dans votre navigateur. L'application prépare le texte à lui donner : vous le copiez, puis vous recollez sa réponse.
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {AI_SITES.map(site => (
          <button
            key={site.url} type="button" onClick={() => void openAiSite(site.url)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-[var(--pc-border)] bg-white dark:bg-[var(--pc-card)] hover:bg-gray-100"
          >
            <ExternalLink className="w-3 h-3" aria-hidden="true" /> {site.label}
          </button>
        ))}
      </div>
    </div>
  );
}
