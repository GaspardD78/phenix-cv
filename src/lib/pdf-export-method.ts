/** Méthode d'export PDF (réglage « Options avancées »). Pure : testable sans Tauri. */

export const PDF_METHODS = ['auto', 'webview2', 'edge', 'chrome', 'system'] as const;
export type PdfExportMethod = (typeof PDF_METHODS)[number];

export const DEFAULT_PDF_METHOD: PdfExportMethod = 'auto';
export const PDF_METHOD_SETTING_KEY = 'pdf_export_method';

export const PDF_METHOD_LABELS: Readonly<Record<PdfExportMethod, string>> = {
  auto: 'Automatique (recommandé)',
  webview2: 'WebView2 (intégré à Windows)',
  edge: 'Microsoft Edge',
  chrome: 'Google Chrome',
  system: 'Impression système',
};

export function parsePdfMethod(value: unknown): PdfExportMethod {
  return typeof value === 'string' && (PDF_METHODS as readonly string[]).includes(value) ? (value as PdfExportMethod) : DEFAULT_PDF_METHOD;
}

/** Une méthode imposée qui échoue ne doit pas être masquée par un autre échelon : l'échec est affiché. */
export function fallsBackToSystemPrint(method: PdfExportMethod): boolean {
  return method === 'auto';
}

/** Résumé lisible d'un journal d'export (JSON du backend), pour « Copier les détails de l'erreur ». */
export function formatExportLog(json: string | null): string {
  if (!json) return 'Aucun export PDF enregistré sur cet ordinateur.';
  try {
    const log = JSON.parse(json) as {
      atUnix: number; requested: string; finalMethod: string | null; bytes: number; appVersion: string; os: string;
      systemPrintReason?: string | null;
      attempts: { method: string; ok: boolean; durationMs: number; error: string | null }[];
    };
    const lines = [
      `Export PDF du ${new Date(log.atUnix * 1000).toLocaleString('fr-FR')}`,
      `Phénix CV ${log.appVersion} · ${log.os}`,
      `Méthode demandée : ${log.requested} · méthode utilisée : ${log.finalMethod ?? 'aucune'}${log.bytes ? ` · ${log.bytes} octets` : ''}`,
      ...log.attempts.map(a => `- ${a.method} : ${a.ok ? 'réussi' : 'échec'} en ${a.durationMs} ms${a.error ? ` (${a.error})` : ''}`),
    ];
    if (log.systemPrintReason) lines.push(`- impression système : ${log.systemPrintReason}`);
    return lines.join('\n');
  } catch {
    return json;
  }
}
