import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TrackerImportPreview } from './TrackerImportPreview';
import { buildImportPlan, withDecision, type MappedRow } from '@/lib/tracker-import/plan';

const decode = (html: string) => html.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const rows: MappedRow[] = [
  { line: 2, values: { companyName: 'Laiterie du Val', jobTitle: 'Assistante ADV', status: 'Envoyé', appliedAt: '12/03/2026' } },
  { line: 3, values: { companyName: 'Négoce Rhône Matériaux', jobTitle: 'Assistante commerciale', status: 'Entretien', appliedAt: 'mars 2026' } },
  { line: 4, values: { jobTitle: 'Sans entreprise' } },
];
const existing = [{ id: 'app-1', companyName: 'Laiterie du Val', jobTitle: 'Assistante ADV', appliedAt: '2026-03-10', createdAt: '2026-03-10' }];
const render = (plan = buildImportPlan(rows, existing)) =>
  decode(renderToStaticMarkup(<TrackerImportPreview plan={plan} onChange={() => {}} onConfirm={() => {}} onBack={() => {}} />));

describe('aperçu avant import', () => {
  it('résumé, colonnes, erreurs avec leur raison, doublon avec le choix', () => {
    const html = render();
    expect(html).toContain('3 lignes lues · 1 prête · 1 en erreur · 1 doublon possible');
    expect(html).toContain('Colonnes du suivi : Entretien 1');
    expect(html).toContain('Ligne 4 : Pas de nom d\'entreprise : ligne ignorée.');
    expect(html).toContain('« Laiterie du Val – Assistante ADV » existe déjà dans votre suivi (candidature du 10/03/2026).');
    for (const label of ['Ignorer', 'Fusionner (compléter les champs vides)', 'Ajouter quand même']) expect(html).toContain(label);
    expect(html).toContain('1 point à vérifier');
    expect(html).toContain('Importer 1 candidature');
  });

  it('le choix « Ajouter quand même » est compté dans les lignes prêtes', () => {
    const html = render(withDecision(buildImportPlan(rows, existing), 2, 'add'));
    expect(html).toContain('3 lignes lues · 2 prêtes');
    expect(html).toContain('Importer 2 candidatures');
  });
});

describe('aperçu : alertes d\'une ligne en erreur', () => {
  it('affichées sous la raison de l\'erreur, et pas comptées dans les points à vérifier', () => {
    const plan = buildImportPlan([{ line: 5, values: { companyName: 'Biscuiterie des Monts' } }], []);
    plan.items[0].alerts.push('Poste « Responsable administrative » ne figure pas dans votre tableau : ignoré.');
    const html = render(plan);
    expect(html).toContain('Ligne 5 : Pas d\'intitulé de poste : ligne ignorée.');
    expect(html).toContain('Poste « Responsable administrative » ne figure pas dans votre tableau : ignoré.');
    expect(html).not.toContain('point à vérifier');
  });
});
