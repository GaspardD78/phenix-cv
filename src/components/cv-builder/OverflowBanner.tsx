import { useEffect, useState } from 'react';
import { overflowStatus, resolveLineAnchor } from '@/lib/print-overflow';
import type { PreviewOverflowState } from '@/hooks/usePrintOverflow';

/** Extrait lisible d'une ligne de texte pour le bandeau. */
function excerpt(text: string, max = 70): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const mm = (value: number) => value.toLocaleString('fr-FR');

/**
 * Couleurs en style en ligne, pas en classes Tailwind : l'export PDF intègre
 * tout le CSS de l'app, et de nouvelles classes changeraient le HTML exporté.
 */
const TONE: Record<string, React.CSSProperties> = {
  // Plus d'une page : information (l'export PDF continue sur les pages suivantes), pas une erreur.
  'dépasse': { borderColor: '#93c5fd', backgroundColor: '#eff6ff', color: '#1e3a8a' },
  'de justesse': { borderColor: '#fcd34d', backgroundColor: '#fffbeb', color: '#92400e' },
  'tient': { borderColor: '#6ee7b7', backgroundColor: '#ecfdf5', color: '#065f46' },
  neutral: { borderColor: '#d1d5db', backgroundColor: '#f9fafb', color: '#4b5563' },
};

/**
 * Bandeau d'état de l'aperçu (hors de #printable-cv, jamais exporté) :
 * le CV tient-il sur une page ? Au-delà, l'export PDF continue sur les pages suivantes.
 * - première mesure : « Vérification… » ;
 * - mesure suivante : statut précédent grisé, avec « mise à jour… ».
 */
export function OverflowBanner({ state }: { state: PreviewOverflowState }) {
  const { result, updating, error } = state;

  let tone = 'neutral';
  let message: React.ReactNode;
  if (!result) {
    message = error ? 'Vérification de la mise en page impossible.' : 'Vérification…';
  } else {
    const status = overflowStatus(result);
    tone = status;
    const last = result.lastVisibleLine;
    if (status === 'dépasse') {
      message = (
        <>
          <strong>Votre CV fait plus d'une page</strong> : l'export PDF le répartit sur plusieurs pages, sans rien couper.
          {' '}Pour tout garder sur une page, utilisez « Ajuster à 1 page ».
        </>
      );
    } else if (status === 'de justesse') {
      message = (
        <>
          <strong>Tient de justesse sur une page</strong> : marge restante {mm(result.remainingMm)} mm
          {last ? <>, la ligne « {excerpt(last.text)} » pourrait passer sur une deuxième page.</> : '.'}
        </>
      );
    } else {
      message = <><strong>Tient sur une page</strong> : marge restante {mm(result.remainingMm)} mm.</>;
    }
  }

  // Mise à jour d'un état déjà affiché (résultat ou erreur) : grisé, jamais « Vérification… ».
  const stale = updating && (Boolean(result) || error);
  return (
    <div
      role="status"
      aria-live="polite"
      className="print:hidden w-[210mm] max-w-full mx-auto mb-3 px-3 py-2 rounded-md border"
      style={{ ...TONE[tone], fontSize: 13, lineHeight: 1.375 }}
    >
      <span className={stale ? 'opacity-50' : undefined}>{message}</span>
      {stale && <span className="ml-2 text-xs italic text-gray-500 dark:text-[var(--pc-muted)]">mise à jour…</span>}
    </div>
  );
}

interface OverflowCutLineProps {
  state: PreviewOverflowState;
  /** Le #printable-cv de l'aperçu. */
  cvElement: HTMLElement | null;
  /** Conteneur de la page A4 (position: relative) dans lequel le trait est placé. */
  container: HTMLElement | null;
}

/**
 * Repère de fin de la première page sur l'aperçu. L'aperçu n'a pas la mise en
 * page d'impression (marges d'écran) : le trait n'est pas placé à 297 mm mais
 * au-dessus de la première ligne qui dépasse, retrouvée dans l'aperçu par son
 * ancrage. Repère approximatif : à l'export, un bloc (expérience, titre de
 * section) peut passer entier sur la page suivante. Affiché seulement si le CV
 * dépasse et que la mesure est à jour.
 */
export function OverflowCutLine({ state, cvElement, container }: OverflowCutLineProps) {
  const [top, setTop] = useState<number | null>(null);
  const line = state.result && overflowStatus(state.result) === 'dépasse' ? state.result.firstCutLine : null;
  const visible = Boolean(line) && !state.updating;

  useEffect(() => {
    if (!visible || !line || !cvElement || !container) { setTop(null); return; }
    const place = () => {
      const anchor = resolveLineAnchor(cvElement, line);
      if (!anchor) { setTop(null); return; }
      const range = document.createRange();
      range.setStart(anchor.node, anchor.offset);
      range.setEnd(anchor.node, Math.min(anchor.offset + 1, anchor.node.data.length));
      const r = range.getBoundingClientRect();
      const box = container.getBoundingClientRect();
      // Échelle effective (zoom éventuel de l'aperçu) : taille affichée / taille CSS.
      const scale = container.offsetHeight > 0 ? box.height / container.offsetHeight : 1;
      setTop((r.top - box.top) / (scale || 1));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(container);
    window.addEventListener('resize', place);
    return () => { ro.disconnect(); window.removeEventListener('resize', place); };
  }, [visible, line, cvElement, container]);

  if (!visible || top === null) return null;
  return (
    <div
      className="absolute left-0 w-full print:hidden z-50 pointer-events-none"
      style={{ top: Math.max(0, top - 3), borderTop: '2px dashed #3b82f6' }}
    >
      <span className="absolute right-2 -top-5 text-xs text-blue-700 font-semibold bg-white dark:bg-[var(--pc-card)] px-1">
        Fin de la page 1 (environ)
      </span>
    </div>
  );
}
