import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

/** Textes affichés de la fenêtre « Enrichir avec une IA » : pas de jargon, rôle de l'IA annoncé. */
const source = readFileSync(new URL('./AiEnrichModal.tsx', import.meta.url), 'utf8');
/**
 * Textes visibles : contenus JSX entre balises et chaînes entre guillemets. Les imports et les
 * identifiants internes d'un seul mot en minuscules (ex. l'étape `'prompt'`) ne s'affichent pas.
 */
const visible = [
  ...[...source.matchAll(/>([^<>{}]*[A-Za-zÀ-ÿ][^<>{}]*)</g)].map(m => m[1]),
  ...[...source.matchAll(/'([^'\n]*[A-Za-zÀ-ÿ ][^'\n]*)'/g)].map(m => m[1]).filter(t => !t.startsWith('@/') && !t.startsWith('.') && !/^[a-z][a-zA-Z0-9_-]*$/.test(t)),
].join('\n');

describe('fenêtre « Enrichir avec une IA » : vocabulaire', () => {
  it('aucun jargon dans les textes affichés', () => {
    expect(visible).not.toMatch(/\bLLM\b/);
    expect(visible).not.toMatch(/\bJSON\b/);
    expect(visible).not.toMatch(/\b[Pp]rompt\b/);
    expect(visible).not.toMatch(/\b[Cc]oach\b/);
  });

  it('précise qu\'il s\'agit d\'une IA générative et le rôle qu\'on lui donne', () => {
    expect(visible).toContain('IA générative');
    expect(visible).toContain('jouer le rôle d\'un conseiller CV');
    expect(visible).toContain('Préparer le texte à copier');
  });
});
