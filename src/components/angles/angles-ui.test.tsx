import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewAngleButton, AffinityImportSummary } from '../settings/CvAnglesSettings';
import { AffinityMatrix } from './AffinityMatrix';
import { rowToAngle, fieldsToRow, DEFAULT_ANGLES, planAffinityImport } from '@/lib/cv-angles';
import { makeAngleEntries } from '@/lib/test-helpers/angle-fixtures';

const angle = rowToAngle({ id: 'a1', profile_id: 'p1', ...fieldsToRow({ ...DEFAULT_ANGLES[0], slug: 'expertise', label: 'Assistante commerciale' }) });

describe('interface des angles', () => {
  it('« Nouvel angle » désactivé à 5 angles, actif en dessous', () => {
    expect(renderToStaticMarkup(<NewAngleButton count={5} onClick={() => {}} />)).toContain('disabled=""');
    expect(renderToStaticMarkup(<NewAngleButton count={5} onClick={() => {}} />)).toContain('5 au maximum');
    expect(renderToStaticMarkup(<NewAngleButton count={4} onClick={() => {}} />)).not.toContain('disabled=""');
  });

  it('matrice : état de chaque cellule d\'après les tags, titre propre', () => {
    const html = renderToStaticMarkup(<AffinityMatrix entries={makeAngleEntries()} angles={[angle]} onChange={() => {}} />);
    expect(html).toContain('Assistante commerciale : Mettre en tête');
    expect(html).toContain('Assistante commerciale : Masquer par défaut');
    expect(html).toContain('Assistante commerciale : Neutre'); // k2, sans tag
    expect(html).toContain('>Assistante commerciale<span class="text-gray-400"> - Acme</span>'); // « (Acme) » retiré sous l'employeur Acme
  });

  it('récapitulatif d\'import avant écriture', () => {
    const plan = planAffinityImport([
      { entryType: 'skill', title: 'Langages', tags: ['angle:expertise'] },
      { entryType: 'skill', title: 'Absente', tags: ['angle:expertise'] },
    ], makeAngleEntries());
    const html = renderToStaticMarkup(<AffinityImportSummary plan={plan} onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('1 entrée(s) du fichier retrouvée(s)');
    expect(html).toContain('1 tag(s) ajouté(s) sur 1 entrée(s)');
    expect(html).toContain('1 entrée(s) du fichier sans correspondance');
  });
});
