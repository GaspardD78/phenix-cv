import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from 'sonner';
import { isTauri } from './platform';
import { measurePrintOverflow } from './print-overflow';
import { PDF_METHOD_SETTING_KEY, fallsBackToSystemPrint, parsePdfMethod, type PdfExportMethod } from './pdf-export-method';

/**
 * Exporte le CV en PDF.
 *
 * | Plateforme | Stratégie |
 * |---|---|
 * | Desktop Tauri | `generate_pdf` (Rust) : WebView2 → Edge → Chrome (vectoriel), puis impression système |
 *
 * Le CV est imprimé dans le flux du document : il occupe autant de pages A4 que
 * nécessaire, chaque page reprenant ses marges (voir `@media print`, App.css).
 * | Navigateur web | `window.print()` système |
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Convertit une URL d'image en data URL base64 pour l'inlining HTML. */
async function getBase64FromUrl(url: string): Promise<string> {
  try {
    const data = await fetch(url);
    const blob = await data.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => resolve(reader.result as string);
    });
  } catch (error) {
    console.error(`Impossible de charger l'image ${url}:`, error);
    return url;
  }
}

/**
 * Récupère le contenu textuel de tous les stylesheets (y compris les liens
 * externes générés par Vite) et les transforme en balises <style> inline
 * pour que Headless Chrome n'ait pas à résoudre des URLs locales (file://).
 */
async function getInlinedStyles(): Promise<string> {
  const styles: string[] = [];
  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));

  for (const tag of styleTags) {
    if (tag.tagName.toLowerCase() === 'style') {
      styles.push(tag.outerHTML);
    } else if (tag.tagName.toLowerCase() === 'link') {
      const href = (tag as HTMLLinkElement).href;
      try {
        const response = await fetch(href);
        const cssText = await response.text();
        styles.push(`<style>${cssText}</style>`);
      } catch (err) {
        console.warn(`Impossible d'inliner le stylesheet: ${href}`, err);
        styles.push(tag.outerHTML);
      }
    }
  }

  return styles.join('\n');
}

// ── Chemin Web Fallback (print système) ───────────────────────────────────────

async function exportPdfWebFallback(): Promise<boolean> {
  toast.info('Génération du PDF via le navigateur…', {
    description: "Veuillez cliquer sur 'Enregistrer en PDF' dans la fenêtre d'impression.",
    duration: 5000,
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  try {
    window.print();
    return true;
  } catch (err) {
    console.error("Erreur lors de l'impression fallback:", err);
    return false;
  }
}

// ── Chemin Desktop (Vectoriel natif via Headless Chrome) ─────────────────────

/**
 * Construit le document HTML autonome envoyé à `generate_pdf` (Headless Chrome).
 * Partagé avec la mesure de dépassement de page (`print-overflow.ts`) pour que
 * la mesure porte exactement sur le document imprimé.
 */
export async function buildDesktopExportHtml(cvNode: HTMLElement): Promise<string> {
  const clonedCv = cvNode.cloneNode(true) as HTMLElement;
  const inlinedStyles = await getInlinedStyles();

  const images = clonedCv.querySelectorAll('img');
  for (const img of Array.from(images)) {
    if (img.src && !img.src.startsWith('data:')) {
      img.src = await getBase64FromUrl(img.src);
    }
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <title>CV</title>
        ${inlinedStyles}
        <style>
          body {
            margin: 0;
            padding: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #printable-cv {
            width: 100% !important;
            height: auto !important;
            min-height: 100vh;
            margin: 0;
            box-shadow: none !important;
          }
          @page {
            margin: 0;
            size: A4 portrait;
          }
        </style>
      </head>
      <body>
        ${clonedCv.outerHTML}
      </body>
    </html>
  `;

  return htmlContent;
}

/**
 * CV de plusieurs pages : chaque page reprend les marges intérieures du CV
 * (haut et bas). Ajouté seulement quand la mesure annonce un dépassement : la
 * reprise réserve aussi la marge du bas sur la première page, ce qui ferait
 * passer sur deux pages un CV qui tient de justesse.
 */
export const MULTIPAGE_PRINT_CSS =
  '@media print { #printable-cv, #printable-cv .cv-sidebar, #printable-cv .cv-main-col, #printable-cv .cv-panel ' +
  '{ -webkit-box-decoration-break: clone; box-decoration-break: clone; } }';

/**
 * CV dont tout le texte tient sur la première page : le CV est borné à une page.
 * Sans cela, une marge intérieure ou un espacement sous le dernier texte qui
 * dépasse de quelques dixièmes de millimètre ouvrirait une deuxième page, ou
 * ferait passer tout un bloc de colonnes sur la suivante. Seul de l'espace vide
 * est concerné : la mesure garantit que le texte s'arrête avant 297 mm.
 */
export const SINGLE_PAGE_PRINT_CSS = '@media print { #printable-cv { max-height: 297mm; overflow: hidden; } }';

/** Ajuste le HTML d'export à la longueur mesurée du CV (voir MULTIPAGE_PRINT_CSS et SINGLE_PAGE_PRINT_CSS). */
export async function withPagination(html: string): Promise<string> {
  let css: string;
  try {
    const overflow = await measurePrintOverflow(html);
    css = overflow.overflows ? MULTIPAGE_PRINT_CSS : SINGLE_PAGE_PRINT_CSS;
  } catch (error) {
    // Sans mesure, l'export continue : le CV est imprimé en entier, sans reprise des marges.
    console.error('Mesure de la longueur du CV impossible :', error);
    return html;
  }
  return html.replace('</head>', `<style>${css}</style>\n</head>`);
}

async function exportPdfDesktop(sourceElementId: string, options: ExportPdfOptions): Promise<boolean> {
  const cvNode = document.getElementById(sourceElementId);
  if (!cvNode) {
    console.error(`exportPdfDesktop: #${sourceElementId} introuvable`);
    return false;
  }

  const htmlContent = await withPagination(await buildDesktopExportHtml(cvNode));

  const method = options.method ?? (await readConfiguredMethod());

  try {
    const filePath = await save({
      defaultPath: options.defaultFileName ?? 'cv_export.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (!filePath) return false;

    // Impression système demandée explicitement : aucun export direct.
    if (method === 'system') {
      await logSystemPrint('méthode imposée dans les options avancées');
      return exportPdfWebFallback();
    }

    const result = await invoke<{ bytes: number[]; method: string }>('generate_pdf', { html: htmlContent, method });
    await writeFile(filePath, new Uint8Array(result.bytes));
    options.onSaved?.(filePath);
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Erreur lors de l'export PDF vectoriel natif:", error);
    if (fallsBackToSystemPrint(method)) {
      toast.error("L'export PDF direct n'a pas fonctionné.", {
        description: "Nous passons par l'impression de Windows : choisissez « Enregistrer au format PDF ».",
      });
      await logSystemPrint(detail);
      return exportPdfWebFallback();
    }
    // Méthode imposée : l'échec est montré tel quel pour pouvoir tester chaque échelon.
    toast.error(`L'export PDF a échoué avec la méthode choisie (${method}).`, { description: detail, duration: 10000 });
    return false;
  }
}

async function readConfiguredMethod(): Promise<PdfExportMethod> {
  try {
    const { getSetting } = await import('./db');
    return parsePdfMethod(await getSetting(PDF_METHOD_SETTING_KEY));
  } catch {
    return 'auto';
  }
}

/** Ajoute l'impression système au journal du dernier export (sans jamais faire échouer l'export). */
async function logSystemPrint(reason: string): Promise<void> {
  try {
    await invoke('log_pdf_system_print', { reason });
  } catch {
    /* journal facultatif */
  }
}

// ── Point d'entrée public ─────────────────────────────────────────────────────

export interface ExportPdfOptions {
  /** Méthode imposée ; sinon le réglage « Options avancées » (automatique par défaut). */
  method?: PdfExportMethod;
  /** Appelé avec le chemin du fichier une fois le PDF écrit (ex. pour « Ouvrir le dossier »). */
  onSaved?: (filePath: string) => void;
  /** Nom proposé dans la fenêtre d'enregistrement (modifiable), voir lib/export-filename.ts. */
  defaultFileName?: string;
}

/**
 * Exporte le CV en PDF.
 * - Desktop Tauri   → WebView2, Edge, Chrome (vectoriel), puis impression système
 * - Navigateur web  → window.print()
 */
export async function exportNativePdf(sourceElementId = 'printable-cv', options: ExportPdfOptions = {}): Promise<boolean> {
  if (!isTauri()) {
    return exportPdfWebFallback();
  }

  return exportPdfDesktop(sourceElementId, options);
}
