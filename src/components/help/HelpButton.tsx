import { useEffect, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { HELP, type HelpId } from '@/content/help';
import { WikiLink } from './WikiLink';

/**
 * Icône « ? » à côté d'un titre de section : au clic, un court résumé avec un exemple, puis un lien vers le wiki.
 * Fermeture : clic à l'extérieur, touche Échap, ou second clic sur l'icône.
 */
export function HelpButton({ id, className = '' }: { id: HelpId; className?: string }) {
  const entry = HELP[id];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={`Aide : ${entry.title}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[var(--pc-muted)] hover:text-[var(--pc-accent)] hover:bg-[var(--pc-accent-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pc-accent)]"
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={entry.title}
          className="absolute left-0 top-full mt-2 z-50 w-72 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-card)] p-4 shadow-xl text-left text-[var(--pc-text)]"
        >
          <p className="font-semibold text-sm mb-1">{entry.title}</p>
          <p className="text-sm leading-relaxed text-[var(--pc-text)]">{entry.summary}</p>
          {entry.example && (
            <p className="text-xs mt-2 leading-relaxed text-[var(--pc-muted)]"><span className="font-medium">Exemple :</span> {entry.example}</p>
          )}
          <div className="mt-3 text-sm">
            <WikiLink page={entry.page} />
          </div>
        </div>
      )}
    </span>
  );
}
