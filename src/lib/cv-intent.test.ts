import { describe, expect, it } from 'bun:test';
import { DEFAULT_INTENT, experienceBudget, intentToTarget, proposalToResponse, proposeCv, tokens, yearsOfExperience, type CvIntent } from './cv-intent';
import { applyAiCvToBlocks } from './apply-ai-cv';
import { makeBlocks, makeEntry, makeFakeStore, TEST_PROFILE } from './test-helpers/cv-fixtures';
import type { MasterEntry } from '@/types/profile';

const NOW = new Date(Date.UTC(2026, 5, 15));

const exp = (id: string, title: string, subtitle: string, start: string, end: string | null, description = ''): MasterEntry =>
  makeEntry(id, 'experience', title, { subtitle, startDate: start, endDate: end, isCurrent: end === null, description });

function profile(): MasterEntry[] {
  return [
    exp('e1', 'Assistante commerciale', 'Maison Lambert', '2021-03', null, '- Gérer les commandes de 40 clients\n- Rédiger les devis'),
    exp('e2', 'Assistante administrative', 'Atelier Dupré', '2018-09', '2021-02', '- Suivre la facturation'),
    exp('e3', 'Hôtesse d\'accueil', 'Groupe Horizon', '2016-09', '2018-08', '- Accueillir 80 visiteurs par jour'),
    exp('e4', 'Vendeuse', 'Boutique du Marché', '2014-09', '2016-08', '- Conseiller la clientèle'),
    exp('e5', 'Employée polyvalente', 'Restaurant La Table', '2012-06', '2014-08', '- Servir en salle'),
    exp('e6', 'Serveuse', 'Café Central', '2011-06', '2012-05', '- Servir'),
    makeEntry('f1', 'education', 'BTS Support à l\'action managériale', { subtitle: 'Lycée Exemple', startDate: '2014', endDate: '2016' }),
    makeEntry('f2', 'education', 'Baccalauréat professionnel', { subtitle: 'Lycée Exemple', startDate: '2011', endDate: '2014' }),
    makeEntry('f3', 'education', 'Brevet', { subtitle: 'Collège', startDate: '2007', endDate: '2011' }),
    ...['Excel', 'Salesforce', 'Négociation', 'Relation client', 'Facturation'].map((t, i) => makeEntry(`s${i}`, 'skill', t)),
    makeEntry('l1', 'language', 'Anglais', { subtitle: 'Courant' }),
    makeEntry('i1', 'interest', 'Randonnée'),
    makeEntry('i2', 'interest', 'Lecture'),
  ];
}

const intent = (over: Partial<CvIntent> = {}): CvIntent => ({ ...DEFAULT_INTENT, role: 'Assistante commerciale', sector: 'négoce', ...over });
const included = (p: ReturnType<typeof proposeCv>, type?: string) => p.items.filter(i => i.include && (!type || i.type === type)).map(i => i.id);

describe('proposeCv : sélection', () => {
  it('une page : 4 expériences au plus, l\'actuelle toujours retenue, les plus proches du poste d\'abord', () => {
    const p = proposeCv(intent(), profile(), TEST_PROFILE, NOW);
    expect(included(p, 'experience')).toHaveLength(experienceBudget(1));
    expect(included(p, 'experience')).toContain('e1');
    expect(included(p, 'experience')).toContain('e2'); // « assistante » proche du poste visé
    expect(included(p, 'experience')).not.toContain('e6');
  });

  it('deux pages : davantage d\'expériences, centres d\'intérêt gardés', () => {
    const p = proposeCv(intent({ pages: 2 }), profile(), TEST_PROFILE, NOW);
    expect(included(p, 'experience')).toHaveLength(6); // le profil n en compte que 6
    expect(included(p, 'interest')).toEqual(['i1', 'i2']);
    expect(included(proposeCv(intent(), profile(), TEST_PROFILE, NOW), 'interest')).toEqual([]);
  });

  it('préférences : « privilégier » force l\'inclusion, « laisser de côté » l\'écarte, même l\'expérience actuelle', () => {
    const p = proposeCv(intent({ preferences: { e6: 'prefer', e1: 'exclude' } }), profile(), TEST_PROFILE, NOW);
    expect(included(p, 'experience')).toContain('e6');
    expect(included(p, 'experience')).not.toContain('e1');
    expect(p.items.find(i => i.id === 'e1')!.reason).toContain('laisser de côté');
  });

  it('formations : deux récentes, toutes pour un début de carrière ou une reconversion', () => {
    expect(included(proposeCv(intent(), profile(), TEST_PROFILE, NOW), 'education')).toEqual(['f1', 'f2']);
    expect(included(proposeCv(intent({ level: 'debutant' }), profile(), TEST_PROFILE, NOW), 'education')).toEqual(['f1', 'f2', 'f3']);
    expect(included(proposeCv(intent({ highlights: ['reconversion'] }), profile(), TEST_PROFILE, NOW), 'education')).toHaveLength(3);
  });

  it('compétences en lien avec le poste d\'abord, plafonnées', () => {
    const many = [...profile(), ...Array.from({ length: 12 }, (_, i) => makeEntry(`x${i}`, 'skill', `Compétence ${i}`))];
    const p = proposeCv(intent({ role: 'Facturation' }), many, TEST_PROFILE, NOW);
    expect(included(p, 'skill')).toHaveLength(10);
    expect(included(p, 'skill')[0]).toBe('s4');
  });

  it('chaque entrée écartée a une explication', () => {
    const p = proposeCv(intent(), profile(), TEST_PROFILE, NOW);
    for (const i of p.items.filter(x => !x.include)) expect(i.reason.length).toBeGreaterThan(10);
  });

  it('début de carrière : formations avant expériences', () => {
    const p = proposeCv(intent({ level: 'debutant' }), profile(), TEST_PROFILE, NOW);
    expect(p.sectionOrder.slice(0, 2)).toEqual(['Formations', 'Compétences']);
    expect(proposeCv(intent(), profile(), TEST_PROFILE, NOW).sectionOrder[0]).toBe('Expériences Professionnelles');
  });
});

describe('proposeCv : titre et accroche sans invention', () => {
  it('titre = poste visé, sinon titre du profil', () => {
    expect(proposeCv(intent({ role: 'Gestionnaire de commandes' }), profile(), TEST_PROFILE, NOW).title).toBe('Gestionnaire de commandes');
    expect(proposeCv(intent({ role: '' }), profile(), { title: 'Assistante commerciale' }, NOW).title).toBe('Assistante commerciale');
  });

  it('accroche : années calculées depuis les dates, secteur saisi, rien d\'autre', () => {
    const p = proposeCv(intent(), profile(), TEST_PROFILE, NOW);
    expect(p.summary).toBe('Assistante commerciale avec 15 ans d\'expérience dans le secteur négoce.');
    expect(yearsOfExperience(profile(), NOW)).toBe(15);
    expect(yearsOfExperience([], NOW)).toBe(0);
  });

  it('mises en avant : phrases construites uniquement sur des faits du profil', () => {
    const p = proposeCv(intent({ highlights: ['expertise', 'polyvalence'] }), profile(), TEST_PROFILE, NOW);
    expect(p.summary).toContain('Expertise appuyée par');
    expect(p.summary).toContain('Polyvalence acquise dans 6 structures différentes.');
    expect(p.summary.length).toBeLessThan(330);
  });

  it('encadrement sans aucun support dans le profil : rien d\'inventé, un conseil à la place', () => {
    const p = proposeCv(intent({ highlights: ['management'], level: 'encadrement' }), [exp('e9', 'Vendeuse', 'Boutique', '2020-01', null, '- Servir')], TEST_PROFILE, NOW);
    expect(p.summary).not.toContain('encadrement');
    expect(p.notes.join(' ')).toContain('Mon profil');
  });

  it('résultats chiffrés absents du profil : conseil, pas de chiffre inventé', () => {
    const p = proposeCv(intent({ highlights: ['resultats'] }), [exp('e9', 'Vendeuse', 'Boutique', '2020-01', null, '- Servir')], TEST_PROFILE, NOW);
    expect(p.notes.join(' ')).toContain('résultats chiffrés');
    expect(p.summary).not.toMatch(/\d{2,} ?%/);
  });
});

describe('application de la proposition au CV (sans IA)', () => {
  it('masque ce qui est écarté, applique titre, accroche et ordre ; idempotent', async () => {
    const entries = profile();
    const blocks = makeBlocks(entries);
    const store = makeFakeStore(blocks);
    const p = proposeCv(intent(), entries, TEST_PROFILE, NOW);
    const data = proposalToResponse(p);
    await applyAiCvToBlocks('cv1', data, { store: () => store, entries });
    const visible = (id: string) => store.currentCvBlocks.find(b => b.entryId === id)!.isVisible;
    expect(visible('e1')).toBe(true);
    expect(visible('e6')).toBe(false);
    expect(visible('f3')).toBe(false);
    const snapshot = () => JSON.stringify(store.sorted().map(b => [b.id, b.isVisible, b.sortOrder]));
    const first = snapshot();
    await applyAiCvToBlocks('cv1', data, { store: () => store, entries });
    expect(snapshot()).toBe(first);
    expect(data.title).toBe('Assistante commerciale');
  });
});

describe('intentToTarget : passage facultatif à une IA', () => {
  it('sans annonce : poste, secteur, atouts et contexte', () => {
    const t = intentToTarget(intent({ highlights: ['expertise', 'resultats'], level: 'expert' }));
    expect(t.intent).toBe('spontanee');
    expect(t.brief?.positions).toEqual(['Assistante commerciale']);
    expect(t.brief?.activity).toBe('négoce');
    expect(t.brief?.strengths).toEqual(['Mon expertise', 'Mes résultats chiffrés']);
    expect(t.brief?.context).toContain('Je suis expert(e)');
    expect(t.brief?.context).toContain('résultats chiffrés');
  });
  it('tokens : accents, pluriels, mots vides', () => {
    expect([...tokens('Gestion des Commandes clients')].sort()).toEqual(['client', 'commande', 'gestion']);
  });
});
