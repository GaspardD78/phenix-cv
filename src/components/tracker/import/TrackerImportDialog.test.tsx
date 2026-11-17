import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrackerImportDialog } from './TrackerImportDialog';

const decode = (html: string) => html.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"');

describe('import du suivi : première étape', () => {
  it('collage ou fichier .csv, puis « Importer avec l\'IA » en action principale, avec l\'accès aux IA', () => {
    const html = decode(renderToStaticMarkup(<TrackerImportDialog onClose={() => {}} />));
    expect(html).toContain('Importer mon suivi');
    expect(html).toContain('1. Collez votre tableau');
    expect(html).toContain('ou choisissez un fichier .csv');
    const ai = html.indexOf('data-testid="import-with-ai"');
    expect(ai).toBeGreaterThan(-1);
    expect(html.slice(html.lastIndexOf('<button', ai), html.indexOf('>', ai))).toContain('pc-btn-primary');
    expect(html.indexOf('data-testid="ai-site-links"')).toBeGreaterThan(ai);
    expect(html).toContain('Rien n\'est enregistré avant l\'aperçu.');
  });
});
