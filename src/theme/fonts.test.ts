import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_NAMES, FONT_STACKS } from './tokens';
import { getAllTemplates } from '../templates';

/**
 * Polices des CV : uniquement des polices livrées avec Windows 10/11 (aucune installation requise),
 * pour que le rendu soit le même sur tous les PC Windows. Le PDF les embarque (voir le banc golden).
 */
const ALLOWED = new Set(['Calibri', 'Arial', 'Helvetica', 'Georgia', 'Cambria', 'Times New Roman']);

const families = (stack: string): string[] =>
  stack.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, '')).filter(f => f && !/^(serif|sans-serif|monospace)$/i.test(f));

describe('polices des CV', () => {
  it('les familles proposées sont des polices système Windows', () => {
    for (const stack of Object.values(FONT_STACKS)) for (const f of families(stack)) expect(ALLOWED.has(f)).toBe(true);
    for (const name of Object.values(FONT_NAMES)) expect(ALLOWED.has(name)).toBe(true);
  });

  it('les polices Word (DOCX) de chaque modèle sont autorisées', () => {
    for (const t of getAllTemplates()) {
      for (const f of Object.values(t.docx.fonts)) expect(ALLOWED.has(f as string)).toBe(true);
    }
  });

  it('aucune autre police dans les modèles et le rendu (classes font-family, pile de PrintableCV)', () => {
    const dirs = [join(import.meta.dir, '..', 'templates'), join(import.meta.dir, '..', 'components', 'export')];
    const found = new Set<string>();
    for (const dir of dirs) {
      for (const file of readdirSync(dir).filter(f => /\.tsx?$/.test(f) && !/\.test\./.test(f))) {
        const src = readFileSync(join(dir, file), 'utf8');
        for (const m of src.matchAll(/font-family:([^\]\n'"$`]+)/g)) families(m[1]).forEach(f => found.add(f));
        for (const m of src.matchAll(/'([A-Za-z ]+)',\s*(?:'[A-Za-z ]+',\s*)?(?:sans-)?serif/g)) found.add(m[1]);
      }
    }
    expect(found.size).toBeGreaterThan(0);
    for (const f of found) expect(ALLOWED.has(f)).toBe(true);
  });
});
