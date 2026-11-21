import { useEffect, useRef, useState } from 'react';
import { PreviewUnavailableError, rasterizePdf, renderPreviewPdf, type PreviewPage } from '@/lib/pdf-preview';

/** Délai après la dernière modification avant de régénérer l'aperçu (ms). */
const DEBOUNCE_MS = 800;
/** Largeur d'une page A4 à l'écran (px CSS, 210 mm). */
const PAGE_WIDTH_PX = 794;

interface PdfPagesPreviewProps {
  /** Le #printable-cv de l'aperçu (monté, même masqué) : source du PDF. */
  cvElement: HTMLElement | null;
  /** Change à chaque modification du CV (contenu, design, modèle, profil). */
  changeKey: unknown;
}

/**
 * Aperçu des pages : le PDF exporté, page par page (lib/pdf-preview.ts).
 * Régénéré après chaque modification ; les pages précédentes restent affichées,
 * grisées, pendant la mise à jour. Hors de #printable-cv : jamais exporté.
 */
export function PdfPagesPreview({ cvElement, changeKey }: PdfPagesPreviewProps) {
  const [pages, setPages] = useState<PreviewPage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useRef(0);

  useEffect(() => {
    if (!cvElement) return;
    const id = ++run.current;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        const bytes = await renderPreviewPdf(cvElement);
        if (id !== run.current) return;
        const next = await rasterizePdf(bytes, PAGE_WIDTH_PX, Math.max(1.5, Math.min(window.devicePixelRatio || 1, 2)));
        if (id !== run.current) return;
        setPages(next);
        setError(null);
      } catch (e) {
        if (id !== run.current) return;
        console.error("Aperçu des pages impossible :", e);
        setError(e instanceof PreviewUnavailableError
          ? e.message
          : "L'aperçu des pages n'a pas pu être généré. L'export PDF reste possible.");
      } finally {
        if (id === run.current) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [cvElement, changeKey]);

  const total = pages?.length ?? 0;
  return (
    <div className="flex flex-col items-center gap-6 pb-8" aria-live="polite" data-testid="pdf-pages-preview">
      <p className="text-xs text-gray-600 dark:text-[var(--pc-muted)]" style={{ minHeight: 18 }}>
        {error ?? (pages
          ? <>Le PDF tel qu'il sera exporté : <strong>{total} page{total > 1 ? 's' : ''}</strong>.{busy ? ' Mise à jour…' : ''}</>
          : 'Préparation des pages…')}
      </p>
      {pages?.map((p, i) => (
        <figure key={i} className="m-0" style={{ width: PAGE_WIDTH_PX, maxWidth: '100%' }}>
          <img
            src={p.src}
            alt={`Page ${i + 1} sur ${total}`}
            className="block w-full bg-white shadow-lg transition-opacity"
            style={{ aspectRatio: `1 / ${p.ratio}`, opacity: busy ? 0.55 : 1 }}
          />
          <figcaption className="mt-1 text-center text-xs text-gray-500 dark:text-[var(--pc-muted)]">
            Page {i + 1} / {total}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
