import { describe, expect, it } from 'bun:test';
import { DEFAULT_INTENT, MAX_ANSWER_CHARS, experienceBudget, intentToTarget, proposalToResponse, proposeCv, readCvIntent, tokens, withCvIntent, yearsOfExperience, type CvIntent } from './cv-intent';
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
    expect(p.summary).toBe('Assistante commerciale avec 15 ans d\'expérience, dont 7 ans dans ce métier, dans le secteur négoce.');
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

import { experienceSpan, roleExperienceSpan } from './cv-intent';

describe('années d\'expérience : périodes fusionnées', () => {
  const now = new Date(Date.UTC(2026, 5, 15)); // juin 2026
  const job = (id: string, title: string, start: string, end: string | null) =>
    makeEntry(id, 'experience', title, { startDate: start, endDate: end, isCurrent: end === null });

  it('deux postes en parallèle ne comptent pas double', () => {
    const e = [job('a', 'Vendeuse', '2010-01', '2015-12'), job('b', 'Formatrice', '2012-01', '2013-12')];
    const span = experienceSpan(e, now);
    expect(span.months).toBe(72); // 2010 à 2015 : 6 ans, le second poste est inclus
    expect(span.years).toBe(6);
  });

  it('les trous ne sont pas comptés', () => {
    const e = [job('a', 'Vendeuse', '2010-01', '2011-12'), job('b', 'Vendeuse', '2015-01', '2016-12')];
    expect(experienceSpan(e, now).months).toBe(48);
  });

  it('poste en cours : compté jusqu\'à aujourd\'hui', () => {
    const e = [job('a', 'Assistante', '2020-06', null)];
    expect(experienceSpan(e, now).months).toBe(73); // juin 2020 à juin 2026 inclus
    expect(experienceSpan(e, now).years).toBe(6);
  });

  it('dates « AAAA » seules : année complète ; dates absentes ou incohérentes : ignorées et signalées', () => {
    const e = [
      makeEntry('a', 'experience', 'Stage', { startDate: '2008', endDate: '2008' }),
      makeEntry('b', 'experience', 'Sans date', {}),
      makeEntry('c', 'experience', 'Incohérent', { startDate: '2015-05', endDate: '2014-01' }),
    ];
    const span = experienceSpan(e, now);
    expect(span.months).toBe(12);
    expect(span.ignored).toBe(2);
    expect(span.firstYear).toBe(2008);
  });

  it('un rapprochement par métier : seules les expériences de ce métier, sur la même logique', () => {
    const e = [
      job('a', 'Responsable ressources humaines', '2008-01', '2017-12'),
      job('b', 'Chargée de recrutement', '2016-01', '2018-12'),
      job('c', 'Vendeuse', '2019-01', '2026-06'),
    ];
    const total = experienceSpan(e, now);
    const role = roleExperienceSpan(e, now, 'Responsable ressources humaines');
    expect(total.years).toBe(18);
    expect(role?.years).toBe(10);
  });

  it('accroche : total et « dont » dans le métier, sans double compte', () => {
    const e = [
      job('a', 'Responsable ressources humaines', '2008-01', '2017-12'),
      job('b', 'Responsable ressources humaines', '2016-01', '2018-12'),
      job('c', 'Vendeuse', '2019-01', null),
    ];
    const p = proposeCv(intent({ role: 'Responsable ressources humaines', sector: '' }), e, TEST_PROFILE, now);
    expect(p.experience.totalYears).toBe(18);
    expect(p.experience.roleYears).toBe(11);
    expect(p.summary).toContain('18 ans');
    expect(p.summary).toContain('dont 11 ans dans ce métier');
  });

  it('pas de « dont » si le métier couvre tout ou si rien ne correspond', () => {
    const e = [job('a', 'Assistante commerciale', '2015-01', '2020-12')];
    const same = proposeCv(intent({ role: 'Assistante commerciale' }), e, TEST_PROFILE, now);
    expect(same.summary).not.toContain('dont');
    const none = proposeCv(intent({ role: 'Architecte' }), e, TEST_PROFILE, now);
    expect(none.summary).not.toContain('dont');
    expect(none.summary).toContain('6 ans');
    expect(none.summary).toContain('Architecte');
  });

  it('les périodes ignorées sont signalées à la personne', () => {
    const e = [job('a', 'Vendeuse', '2015-01', '2020-12'), makeEntry('b', 'experience', 'Sans date', {})];
    const p = proposeCv(intent({ role: 'Vendeuse' }), e, TEST_PROFILE, now);
    expect(p.experience.ignored).toBe(1);
    expect(p.notes.join(' ')).toContain('pas été comptée');
  });
});

describe('réponses enregistrées dans le CV (cv.settings.cvIntent)', () => {
  it('relecture identique après enregistrement', () => {
    const saved = intent({ environment: 'Petite équipe', ease: 'Le suivi des commandes', achievements: 'Salon 2024', avoid: 'Le standard', assertiveness: 'affirme', preferences: { e1: 'prefer' } });
    expect(readCvIntent(withCvIntent({ photoShape: 'rounded-lg' }, saved))).toEqual(saved);
    expect(withCvIntent({ photoShape: 'rounded-lg' }, saved).photoShape).toBe('rounded-lg');
  });

  it('réponses d\'une version précédente : les nouvelles questions sont vides, le ton est « Équilibré »', () => {
    const old = { role: 'Assistante commerciale', sector: 'négoce', level: 'expert', highlights: ['expertise'], preferences: {}, pages: 2, language: 'en' };
    expect(readCvIntent({ cvIntent: old })).toEqual({
      ...DEFAULT_INTENT, role: 'Assistante commerciale', sector: 'négoce', level: 'expert', highlights: ['expertise'], pages: 2, language: 'en',
    });
    expect(DEFAULT_INTENT.assertiveness).toBe('equilibre');
  });

  it('valeurs inattendues ignorées, aucune réponse : null', () => {
    const r = readCvIntent({ cvIntent: { role: 42, level: 'chef', highlights: ['x', 'management'], preferences: { e1: 'bof', e2: 'exclude' }, assertiveness: 'fort', pages: 3 } });
    expect(r).toEqual({ ...DEFAULT_INTENT, highlights: ['management'], preferences: { e2: 'exclude' } });
    expect(readCvIntent({})).toBeNull();
    expect(readCvIntent(null)).toBeNull();
    expect(readCvIntent({ cvIntent: [] })).toBeNull();
  });

  it(`réponses libres limitées à ${MAX_ANSWER_CHARS} caractères`, () => {
    expect(readCvIntent({ cvIntent: { ease: 'x'.repeat(MAX_ANSWER_CHARS + 50) } })?.ease).toHaveLength(MAX_ANSWER_CHARS);
  });
});
