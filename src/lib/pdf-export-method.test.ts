import { describe, expect, it } from 'bun:test';
import { fallsBackToSystemPrint, formatExportLog, parsePdfMethod } from './pdf-export-method';

describe('méthode d\'export PDF', () => {
  it('valeur inconnue ou absente : automatique', () => {
    expect(parsePdfMethod(undefined)).toBe('auto');
    expect(parsePdfMethod('imprimante')).toBe('auto');
    expect(parsePdfMethod('webview2')).toBe('webview2');
    expect(parsePdfMethod('system')).toBe('system');
  });
  it('seul le mode automatique se rabat sur l\'impression système', () => {
    expect(fallsBackToSystemPrint('auto')).toBe(true);
    for (const m of ['webview2', 'edge', 'chrome', 'system'] as const) expect(fallsBackToSystemPrint(m)).toBe(false);
  });
  it('journal lisible', () => {
    const json = JSON.stringify({
      atUnix: 1700000000, requested: 'auto', finalMethod: 'edge', bytes: 1234, appVersion: '0.1.0', os: 'windows',
      attempts: [
        { method: 'webview2', ok: false, durationMs: 20001, error: 'délai dépassé' },
        { method: 'edge', ok: true, durationMs: 900, error: null },
      ],
    });
    const out = formatExportLog(json);
    expect(out).toContain('méthode utilisée : edge');
    expect(out).toContain('- webview2 : échec en 20001 ms (délai dépassé)');
    expect(out).toContain('- edge : réussi en 900 ms');
    expect(formatExportLog(null)).toContain('Aucun export');
    expect(formatExportLog('pas du json')).toBe('pas du json');
  });
});
