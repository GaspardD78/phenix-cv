import { describe, expect, it } from 'bun:test';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrintableCV } from '@/components/export/PrintableCV';
import { generateDocxBlob } from '@/lib/export-docx';
import { keysToCamelCase } from '@/lib/mapping';
import { getAllTemplates, getTemplate } from '@/templates';
import type { BackupData } from '@/lib/backup';
import type { CVBlock, CVDocument } from '@/types/cv';
import type { MasterEntry, Profile } from '@/types/profile';
import { FALLBACK_TEMPLATE_ID, convertCvmakerBackup } from './convert';

/**
 * Lot E : un CV venu de CVmaker s'ouvre à l'écran, s'exporte en PDF (même HTML que l'écran) et en Word,
 * avec tout son contenu. Les fichiers d'exemple sont produits par le vrai code de CVmaker (Camille Martin).
 */
const FIXTURES = join(import.meta.dir, '..', '..', '..', 'tests', 'fixtures', 'cvmaker');
const load = (name: string) => JSON.parse(readFileSync(join(FIXTURES, `${name}.cvmaker`), 'utf8')) as BackupData;

interface Imported { profile: Profile; entries: MasterEntry[]; cvs: { cv: CVDocument; blocks: CVBlock[] }[] }

/** Ce que l'application relit de la base après l'import : lignes converties, mises en forme comme les stores. */
function imported(name: string, keepLink: 'portfolio' | 'github' = 'portfolio'): Imported {
  const { backup } = convertCvmakerBackup(load(name), { keepLink });
  const rows = <T,>(table: string): T[] => (backup.modules[table] ?? []).map(r => keysToCamelCase<T>(r));
  const profile = rows<Profile>('profiles')[0];
  const entries = rows<MasterEntry>('master_entries').map(e => ({ ...e, isCurrent: Boolean(e.isCurrent) }));
  const blocks = rows<CVBlock>('cv_blocks').map(b => ({ ...b, isVisible: Boolean(b.isVisible) }));
  const cvs = rows<CVDocument>('cv_documents').map(cv => ({ cv, blocks: blocks.filter(b => b.cvId === cv.id).sort((a, b) => a.sortOrder - b.sortOrder) }));
  return { profile, entries, cvs };
}

const decode = (s: string) => s.replace(/&#x27;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/ /g, ' ');
const text = (html: string) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');

const screenHtml = ({ profile, entries }: Imported, cv: CVDocument, blocks: CVBlock[]) => renderToStaticMarkup(
  <PrintableCV cv={cv} profile={profile} blocks={blocks} entries={entries} template={getTemplate(cv.templateId)} />,
);
async function docxText(data: Imported, cv: CVDocument, blocks: CVBlock[]): Promise<string> {
  const blob = await generateDocxBlob(cv, data.profile, blocks, data.entries, getTemplate(cv.templateId));
  const xml = await (await JSZip.loadAsync(await blob.arrayBuffer())).file('word/document.xml')!.async('string');
  return decode([...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(m => m[1]).join(' ')).replace(/\s+/g, ' ');
}

/** Éléments qui trahissent une donnée mal lue : jamais dans un CV. */
const BROKEN = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull\b/];

for (const name of ['camille-martin-recent', 'camille-martin-2026-05']) {
  describe(`CV venus de CVmaker (${name})`, () => {
    const data = imported(name);

    it('le fichier donne des CV, avec leurs blocs et un modèle connu de Phénix CV', () => {
      expect(data.cvs.length).toBeGreaterThan(0);
      const known = new Set(getAllTemplates().map(t => t.id));
      for (const { cv, blocks } of data.cvs) {
        expect(blocks.length).toBeGreaterThan(0);
        expect(known.has(cv.templateId)).toBe(true);
        expect(typeof cv.settings).toBe('object');
        for (const b of blocks) expect(typeof b.overrideData).toBe('object');
      }
    });

    for (const [index] of data.cvs.entries()) {
      const { cv, blocks } = data.cvs[index];

      it(`« ${cv.name} » à l'écran et en PDF : nom, titres, dates, aucune donnée cassée`, () => {
        const shown = text(screenHtml(data, cv, blocks));
        expect(shown).toContain('Camille Martin');
        for (const b of blocks.filter(b => b.isVisible && b.entryId)) {
          const entry = data.entries.find(e => e.id === b.entryId)!;
          const title = (b.overrideData as { title?: string }).title ?? entry.title;
          expect(shown).toContain(title);
          if (entry.startDate) expect(shown).toContain(entry.startDate.slice(0, 4));
        }
        for (const re of BROKEN) expect(shown).not.toMatch(re);
      });

      it(`« ${cv.name} » en Word : le même contenu`, async () => {
        const word = await docxText(data, cv, blocks);
        expect(word).toContain('Camille');
        expect(word).toContain('Martin');
        for (const b of blocks.filter(b => b.isVisible && b.entryId)) {
          const entry = data.entries.find(e => e.id === b.entryId)!;
          expect(word).toContain((b.overrideData as { title?: string }).title ?? entry.title);
        }
        for (const re of BROKEN) expect(word).not.toMatch(re);
      });

      it(`« ${cv.name} » : le même contenu dans les 26 modèles, sans exception`, async () => {
        for (const t of getAllTemplates()) {
          const as = { ...cv, templateId: t.id };
          const shown = text(screenHtml(data, as, blocks));
          expect({ template: t.id, ok: shown.includes('Camille Martin') }).toEqual({ template: t.id, ok: true });
          for (const re of BROKEN) expect({ template: t.id, broken: re.test(shown) }).toEqual({ template: t.id, broken: false });
        }
      });
    }
  });
}

describe('cas particuliers à l\'ouverture', () => {
  it('modèle inconnu de Phénix CV : le CV s\'ouvre avec le modèle « Classique »', () => {
    const b = load('camille-martin-recent');
    b.modules.cv_documents = b.modules.cv_documents!.map(d => ({ ...d, template_id: 'modele-qui-n-existe-pas' }));
    const { backup } = convertCvmakerBackup(b, { keepLink: 'portfolio' });
    const cv = keysToCamelCase<CVDocument>(backup.modules.cv_documents![0]);
    expect(cv.templateId).toBe(FALLBACK_TEMPLATE_ID);
    const data = imported('camille-martin-recent');
    expect(text(screenHtml(data, cv, data.cvs[0].blocks))).toContain('Camille Martin');
  });

  it('lien personnel : celui qui est gardé apparaît, l\'autre non', () => {
    const site = imported('camille-martin-recent', 'portfolio');
    const github = imported('camille-martin-recent', 'github');
    expect(site.profile.otherUrl).not.toBe(github.profile.otherUrl);
    const [first] = site.cvs;
    const shownSite = text(screenHtml(site, first.cv, first.blocks));
    const shownGithub = text(screenHtml(github, github.cvs[0].cv, github.cvs[0].blocks));
    if (site.profile.otherUrl) expect(shownSite).toContain(site.profile.otherUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''));
    expect(shownSite).not.toContain(github.profile.otherUrl ?? '§§');
    expect(shownGithub).not.toContain(site.profile.otherUrl ?? '§§');
  });

  it('ancien CV avec une compétence en ligne de texte : visible, à convertir en étiquettes (rien n\'est perdu)', () => {
    const data = imported('camille-martin-recent');
    const skillLines = data.entries.filter(e => e.entryType === 'skill' && (e.description ?? '').includes('\n'));
    const { cv, blocks } = data.cvs[0];
    const shown = text(screenHtml(data, cv, blocks));
    for (const e of skillLines) expect(shown).toContain(e.title);
  });
});
