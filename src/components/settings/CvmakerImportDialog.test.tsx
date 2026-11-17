import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CvmakerImportDialog } from './CvmakerImportDialog';
import type { BackupData } from '@/lib/backup';

const decode = (html: string) => html.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const fixture = JSON.parse(readFileSync(join(import.meta.dir, '..', '..', '..', 'tests', 'fixtures', 'cvmaker', 'camille-martin-recent.cvmaker'), 'utf8')) as BackupData;

describe('récupérer mes données CVmaker : aperçu', () => {
  const html = decode(renderToStaticMarkup(<MemoryRouter><CvmakerImportDialog backup={fixture} onClose={() => {}} /></MemoryRouter>));

  it('origine, et ce qui sera importé', () => {
    expect(html).toContain('Sauvegarde CVmaker (version d\'octobre 2026 ou plus récente)');
    for (const t of ['Profil, coordonnées et photo', '2 expériences', '1 formation', '2 compétences', '1 langue', '1 CV', '1 candidature']) expect(html).toContain(t);
  });

  it('choix du lien personnel, conversions, éléments non repris avec leur raison, points à vérifier', () => {
    expect(html).toContain('Votre site : https://camille-martin.example');
    expect(html).toContain('Votre GitHub : https://github.com/camille-martin-exemple');
    expect(html).toContain('2 dates mises au format de Phénix CV');
    expect(html).toContain('<strong>Veille emploi (1 recherche enregistrée, 1 offre sauvegardée)</strong> : La veille emploi n\'existe pas dans Phénix CV.');
    expect(html).toContain('<strong>Connexions et identifiants (Google Drive…)</strong> : Par sécurité');
    expect(html).toContain('Convertir en étiquettes');
    expect(html).not.toContain('FAUX');
  });

  it('Phénix vide : import direct ; jamais sans votre clic', () => {
    expect(html).toContain('>Importer</button>');
    expect(html).toContain('>Annuler</button>');
  });
});
