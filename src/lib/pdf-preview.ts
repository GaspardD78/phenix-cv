import { invoke } from '@tauri-apps/api/core';
// Vite résout l'URL du worker à la compilation (import statique obligatoire).
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { buildPrintHtml, readConfiguredMethod } from './export-pdf';

/**
 * Aperçu des pages : le PDF exporté, page par page.
 *
 * Même chemin que l'export (`buildPrintHtml` puis la commande Rust
 * `generate_pdf`, même méthode d'impression) : l'aperçu montre exactement le
 * fichier qui sera enregistré (sauts de page, marges, numéros). Seule
 * différence : pas de fenêtre d'enregistrement, et le journal du dernier
 * export n'est pas remplacé (`preview: true`).
 */

export class PreviewUnavailableError extends Error {}

/** Génère le PDF de l'aperçu à partir du #printable-cv affiché. */
export async function renderPreviewPdf(cvNode: HTMLElement): Promise<Uint8Array> {
  const method = await readConfiguredMethod();
  if (method === 'system') {
    throw new PreviewUnavailableError("L'aperçu des pages n'est pas disponible avec l'impression de Windows (Paramètres, options avancées).");
  }
  const html = await buildPrintHtml(cvNode);
  const result = await invoke<{ bytes: number[] }>('generate_pdf', { html, method, preview: true });
  return new Uint8Array(result.bytes);
}

/** Image d'une page du PDF. */
export interface PreviewPage {
  /** Image PNG (data URL). */
  src: string;
  /** Rapport hauteur / largeur de la page. */
  ratio: number;
}

/** Dessine chaque page du PDF à `widthPx` px CSS de large (multipliés par `pixelRatio` pour la netteté). */
export async function rasterizePdf(bytes: Uint8Array, widthPx: number, pixelRatio: number): Promise<PreviewPage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const pages: PreviewPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (widthPx * pixelRatio) / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      pages.push({ src: canvas.toDataURL('image/png'), ratio: base.height / base.width });
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}
