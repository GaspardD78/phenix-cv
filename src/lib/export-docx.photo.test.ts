import { describe, expect, test } from 'bun:test';
import JSZip from 'jszip';
import { generateDocxBlob } from './export-docx';
import { getTemplate } from '../templates';
import type { CVDocument } from '../types/cv';
import { TEST_PROFILE, makeBlocks, makeEntries } from './test-helpers/cv-fixtures';

const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const entries = makeEntries();
const blocks = makeBlocks(entries);

const cv = (templateId: string, settings: Record<string, unknown>): CVDocument => ({
  id: 'cv1', profileId: 'p1', name: 'CV de Camille', templateId, targetJob: 'Assistante commerciale', targetCompany: null,
  customSummary: null, settings, isFavorite: false, lastExported: null, markdownContent: null, markdownMode: 0,
  createdAt: '', updatedAt: '',
});

/** Images contenues dans le fichier Word et présence d'un dessin dans le document. */
async function docxImages(templateId: string, settings: Record<string, unknown>, photoPath: string | null = PHOTO) {
  const blob = await generateDocxBlob(cv(templateId, settings), { ...TEST_PROFILE, photoPath }, blocks, entries, getTemplate(templateId));
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const media = Object.values(zip.files).filter(f => !f.dir && f.name.startsWith('word/media/')).map(f => f.name);
  const xml = await zip.file('word/document.xml')!.async('string');
  return { media, drawing: xml.includes('<w:drawing') };
}

describe('export Word - interrupteur « Afficher la photo »', () => {
  for (const templateId of ['ats-classic', 'sidebar-modern', 'grand-entete']) {
    test(`${templateId} : interrupteur coupé, aucune image dans le fichier`, async () => {
      expect(await docxImages(templateId, { showPhoto: false })).toEqual({ media: [], drawing: false });
    });
  }

  test('réglage absent : la photo du profil est exportée (comportement d\'avant)', async () => {
    const r = await docxImages('ats-classic', {});
    expect(r.media.length).toBe(1);
    expect(r.drawing).toBe(true);
  });

  test('interrupteur coupé : même document que pour un profil sans photo', async () => {
    const off = await docxImages('ats-classic', { showPhoto: false });
    const none = await docxImages('ats-classic', {}, null);
    expect(off).toEqual(none);
  });
});
