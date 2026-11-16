import { describe, expect, it } from 'bun:test';
import { buildExportFilename, cvExportFilename, monthYearSlug } from './export-filename';

const NOV_2026 = new Date(2026, 10, 15);
const MARCH_2027 = new Date(2027, 2, 3);

const build = (firstName: string | null, lastName: string | null, cvTitle: string | null, extension: 'pdf' | 'docx' = 'pdf', date = NOV_2026) =>
  buildExportFilename({ firstName, lastName, cvTitle, date, extension });

describe('buildExportFilename', () => {
  it('suit la convention Prénom_Nom_Titre_MM_AAAA', () => {
    expect(build('Camille', 'Martin', 'Assistante commerciale')).toBe('Camille_Martin_Assistante_commerciale_11_2026.pdf');
  });

  it('supprime les accents', () => {
    expect(build('Élodie', 'Françoise', 'Chargée de clientèle')).toBe('Elodie_Francoise_Chargee_de_clientele_11_2026.pdf');
    expect(build('Zoé', 'Cœur', 'Hôtesse d’accueil')).toBe('Zoe_Coeur_Hotesse_d_accueil_11_2026.pdf');
  });

  it('remplace espaces et apostrophes par un seul _', () => {
    expect(build('  Anne  Marie ', "D'Arc", "Responsable   d'agence")).toBe('Anne_Marie_D_Arc_Responsable_d_agence_11_2026.pdf');
    expect(build('Camille', 'Martin', 'Assistante__ _commerciale')).toBe('Camille_Martin_Assistante_commerciale_11_2026.pdf');
  });

  it('conserve le trait d’union', () => {
    expect(build('Jean-Luc', 'Dupré-Léon', 'Aide-soignant')).toBe('Jean-Luc_Dupre-Leon_Aide-soignant_11_2026.pdf');
  });

  it('supprime les caractères interdits par Windows', () => {
    expect(build('Ca<mi>lle', 'Mar|tin', 'Vente / Achat: "export"*?\\')).toBe('Camille_Martin_Vente_Achat_export_11_2026.pdf');
  });

  it('tronque le titre à 5 mots', () => {
    expect(build('Camille', 'Martin', 'Assistante commerciale et administrative en charge des grands comptes'))
      .toBe('Camille_Martin_Assistante_commerciale_et_administrative_en_11_2026.pdf');
  });

  it('garde seulement les parties présentes', () => {
    expect(build('Camille', '', 'Assistante commerciale')).toBe('Camille_Assistante_commerciale_11_2026.pdf');
    expect(build(null, 'Martin', null)).toBe('Martin_11_2026.pdf');
    expect(build('Camille', 'Martin', '   ')).toBe('Camille_Martin_11_2026.pdf');
    expect(build('', '', 'Assistante')).toBe('Assistante_11_2026.pdf');
  });

  it('nom par défaut CV_MM_AAAA si tout est vide', () => {
    expect(build('', null, '  ')).toBe('CV_11_2026.pdf');
    expect(build('???', '"', '/')).toBe('CV_11_2026.pdf');
    expect(build(null, null, null, 'docx')).toBe('CV_11_2026.docx');
  });

  it('date en MM_AAAA, avec le zéro pour un mois à un chiffre', () => {
    expect(monthYearSlug(MARCH_2027)).toBe('03_2027');
    expect(monthYearSlug(new Date(2026, 11, 31))).toBe('12_2026');
    expect(build('Camille', 'Martin', 'Assistante', 'pdf', MARCH_2027)).toBe('Camille_Martin_Assistante_03_2027.pdf');
  });

  it('extensions .pdf et .docx', () => {
    expect(build('Camille', 'Martin', 'Assistante', 'pdf')).toEndWith('_11_2026.pdf');
    expect(build('Camille', 'Martin', 'Assistante', 'docx')).toBe('Camille_Martin_Assistante_11_2026.docx');
  });
});

describe('cvExportFilename', () => {
  const profile = { firstName: 'Camille', lastName: 'Martin', title: 'Assistante commerciale' };

  it('prend le poste visé du CV, sinon le titre de « Mon profil »', () => {
    expect(cvExportFilename({ targetJob: 'Gestionnaire ADV' }, profile, 'pdf', NOV_2026)).toBe('Camille_Martin_Gestionnaire_ADV_11_2026.pdf');
    expect(cvExportFilename({ targetJob: null }, profile, 'pdf', NOV_2026)).toBe('Camille_Martin_Assistante_commerciale_11_2026.pdf');
  });

  it('propose le même nom en PDF et en DOCX', () => {
    const pdf = cvExportFilename({ targetJob: null }, profile, 'pdf', NOV_2026);
    const docx = cvExportFilename({ targetJob: null }, profile, 'docx', NOV_2026);
    expect(pdf.replace(/\.pdf$/, '')).toBe(docx.replace(/\.docx$/, ''));
  });
});
