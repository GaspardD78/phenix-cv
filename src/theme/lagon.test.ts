import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LAGON, contrastPairs, contrastRatio, type LagonTokens } from './lagon';

/** WCAG AA : 4,5:1 pour le texte normal, 3:1 pour les éléments graphiques (bordures, indicateurs). */
const AA_TEXT = 4.5;

describe('thème Lagon : contraste WCAG AA', () => {
  for (const mode of ['light', 'dark'] as const) {
    it(`mode ${mode} : toutes les paires texte / fond atteignent 4,5:1`, () => {
      for (const [name, fg, bg] of contrastPairs(LAGON[mode])) {
        const ratio = contrastRatio(fg, bg);
        if (ratio < AA_TEXT) throw new Error(`${mode} · ${name} : ${ratio.toFixed(2)}:1 (${fg} sur ${bg})`);
        expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  }

  it('bordures des champs et des cartes : 3:1 au moins contre le fond', () => {
    for (const mode of ['light', 'dark'] as const) {
      const t = LAGON[mode];
      expect(contrastRatio(t.borderActive, t.card)).toBeGreaterThanOrEqual(1.5); // bordure décorative, non porteuse
      expect(contrastRatio(t.accent, t.card)).toBeGreaterThanOrEqual(3); // indicateur actif
    }
  });

  it('le corail n\'est jamais utilisé seul pour du texte sur fond clair (variante foncée prévue)', () => {
    expect(contrastRatio(LAGON.light.coral, LAGON.light.card)).toBeLessThan(AA_TEXT);
    expect(contrastRatio(LAGON.light.coralText, LAGON.light.card)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('thème Lagon : variables CSS = jetons', () => {
  const css = readFileSync(join(import.meta.dir, '..', 'App.css'), 'utf8');
  const block = (selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`bloc ${selector} introuvable`);
    return css.slice(start, css.indexOf('}', start));
  };
  const vars: Record<string, string> = {
    bg: '--pc-bg', surface: '--pc-surface', card: '--pc-card', border: '--pc-border', borderActive: '--pc-border-active',
    accent: '--pc-accent', accentHover: '--pc-accent-hover', text: '--pc-text', muted: '--pc-muted',
    sidebar: '--pc-sidebar', sidebarText: '--pc-sidebar-text', sidebarMuted: '--pc-sidebar-muted',
    coral: '--pc-coral', coralText: '--pc-coral-text', success: '--pc-success', warning: '--pc-warning', danger: '--pc-danger',
  };
  for (const [selector, mode] of [[':root', 'light'], ['.dark', 'dark']] as const) {
    it(`${selector} déclare les jetons du mode ${mode}`, () => {
      const b = block(selector).toLowerCase();
      for (const [key, cssVar] of Object.entries(vars)) {
        const expected = LAGON[mode][key as keyof LagonTokens].toLowerCase();
        expect(b).toContain(`${cssVar}: ${expected};`);
      }
    });
  }
});
