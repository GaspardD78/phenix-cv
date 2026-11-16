import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableCV } from './PrintableCV';
import { getTemplate, templates } from '../../templates';
import type { CVDocument } from '../../types/cv';
import type { Profile } from '../../types/profile';
import { TEST_PROFILE, makeBlocks, makeEntries } from '../../lib/test-helpers/cv-fixtures';

const entries = makeEntries();
const blocks = makeBlocks(entries);
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const profile = { ...TEST_PROFILE, photoPath: PHOTO };

const cv = (templateId: string, settings: Record<string, unknown>): CVDocument => ({
  id: 'cv1', profileId: 'p1', name: 'CV de Camille', templateId, targetJob: 'Assistante commerciale', targetCompany: null,
  customSummary: 'Résumé', settings, isFavorite: false, lastExported: null, markdownContent: null, markdownMode: 0,
  createdAt: '', updatedAt: '',
});

const render = (templateId: string, settings: Record<string, unknown>, p: Profile = profile) =>
  renderToStaticMarkup(<PrintableCV cv={cv(templateId, settings)} profile={p} blocks={blocks} entries={entries} template={getTemplate(templateId)} />);

describe('PrintableCV - interrupteur « Afficher la photo », dans tous les modèles', () => {
  for (const t of Object.values(templates)) {
    it(`${t.id} : aucune photo quand l'interrupteur est coupé`, () => {
      const html = render(t.id, { showPhoto: false });
      expect(html).not.toContain(PHOTO);
      expect(html).not.toContain('Photo de profil');
      // Aucun élément photo (la règle CSS `.cv-hero-photo` du grand en-tête reste dans la feuille de style).
      expect(html).not.toMatch(/<img[^>]*>/);
      expect(html).not.toMatch(/class="[^"]*cv-hero-photo/);
    });
  }

  it('réglage absent ou activé : la photo reste affichée (en-tête, bande latérale, grand en-tête)', () => {
    for (const id of ['ats-classic', 'sidebar-modern', 'grand-entete']) {
      expect(render(id, {})).toContain(PHOTO);
      expect(render(id, { showPhoto: true })).toContain(PHOTO);
    }
  });

  it('grand en-tête sans photo : le bloc reprend la mise en page prévue sans photo', () => {
    const off = render('grand-entete', { showPhoto: false });
    const none = render('grand-entete', {}, { ...profile, photoPath: null });
    expect(off).not.toContain('cv-header-hero-photo');
    // Même rendu que pour un profil sans photo.
    expect(off).toBe(none);
  });

  it('le monogramme revient à la place de la photo', () => {
    expect(render('monogramme', { showPhoto: false })).toBe(render('monogramme', {}, { ...profile, photoPath: null }));
  });
});
