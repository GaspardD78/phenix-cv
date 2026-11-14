import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { ImportPage } from './ImportPage';

describe('écran d\'import', () => {
  const html = renderToStaticMarkup(<MemoryRouter><ImportPage /></MemoryRouter>);

  it('zone de dépôt, bouton « Choisir un fichier » et alternatives', () => {
    expect(html).toContain('data-testid="import-dropzone"');
    expect(html).toContain('Glissez votre CV ici');
    expect(html).toContain('Choisir un fichier');
    expect(html).toContain('J&#x27;ai un export LinkedIn');
    expect(html).toContain('Je préfère remplir moi-même');
  });

  it('vocabulaire simple : ni « LLM » ni « JSON » à l\'écran', () => {
    expect(html).not.toMatch(/LLM|JSON|prompt/i);
  });
});
