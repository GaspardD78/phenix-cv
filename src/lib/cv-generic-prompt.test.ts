import { describe, expect, it } from 'bun:test';
import {
  ANSWERS_AS_SOURCE_RULE, ASSERTIVENESS_FACTS_RULE, ASSERTIVENESS_RULES, buildGenericCvPrompt, buildGenericTarget,
} from './cv-generic-prompt';
import { buildCvPrompt } from './cv-prompt';
import { ASSERTIVENESS, DEFAULT_INTENT, INTENT_QUESTIONS, candidateAnswersText, type CvIntent } from './cv-intent';
import { guardAiCv } from './ai-cv-guard';
import { TEST_PROFILE, makeEntry } from './test-helpers/cv-fixtures';

// Personne fictive : Camille Martin, assistante commerciale.
const NOW = new Date(Date.UTC(2026, 5, 15));
const profile = { ...TEST_PROFILE, firstName: 'Camille', lastName: 'Martin' };
const entries = [
  makeEntry('e1', 'experience', 'Assistante commerciale', {
    subtitle: 'Organisation A', startDate: '2019-03', isCurrent: true,
    description: '- Suivre les commandes de 40 clients\n- Rédiger les devis avec les commerciaux\n- Participer à la préparation des salons',
  }),
  makeEntry('e2', 'experience', 'Hôtesse d\'accueil', {
    subtitle: 'Organisation B', startDate: '2016-09', endDate: '2019-02', description: '- Accueillir les visiteurs\n- Gérer le standard',
  }),
  makeEntry('s1', 'skill', 'Relation client'),
  makeEntry('f1', 'education', 'BTS Négociation et relation client', { subtitle: 'Lycée Exemple', startDate: '2014', endDate: '2016' }),
];

const intent = (over: Partial<CvIntent> = {}): CvIntent => ({
  ...DEFAULT_INTENT,
  role: 'Assistante commerciale',
  sector: 'distribution',
  environment: 'Une petite équipe, avec beaucoup de contact client',
  ease: 'La relation client et le suivi des commandes',
  achievements: 'Réduit les retards de livraison de 15 % en réorganisant le suivi des commandes',
  highlights: ['resultats'],
  avoid: "L'accueil au standard",
  ...over,
});

const prompt = (over: Partial<CvIntent> = {}) => buildGenericCvPrompt({ profile, entries, intent: intent(over), options: { now: NOW } });
/** Texte d'instruction sans la clé JSON `langue_annonce`, qui ne change pas. */
const instructions = (p: string) => p.replace(/langue_annonce/g, '');

describe('prompt du CV standard (coach de carrière)', () => {
  for (const level of ASSERTIVENESS) {
    it(`instantané : niveau ${level}`, () => {
      expect(prompt({ assertiveness: level })).toMatchSnapshot();
    });
  }

  it('rôle de coach, aucune annonce ni entreprise visée', () => {
    const p = prompt();
    expect(p).toContain('Tu es un coach de carrière');
    expect(p).toContain('aucune annonce et aucune entreprise ne sont visées');
    expect(instructions(p)).not.toMatch(/annonce(?! et aucune entreprise)/i);
    expect(p).not.toContain('Entreprise cible');
    expect(p).not.toContain('candidature spontanée');
  });

  it('les sept réponses figurent dans la cible, et les questions sans réponse sont omises', () => {
    const p = prompt();
    for (const q of Object.values(INTENT_QUESTIONS)) expect(p).toContain(q);
    expect(p).toContain('Réduit les retards de livraison de 15 %');
    const empty = buildGenericTarget({ ...DEFAULT_INTENT, role: 'Assistante commerciale' });
    expect(empty).not.toContain(INTENT_QUESTIONS.environment);
    expect(empty).not.toContain(INTENT_QUESTIONS.achievements);
    expect(empty).toContain(INTENT_QUESTIONS.level);
  });

  it('un seul niveau d\'affirmation à la fois, et la règle « les faits ne changent pas » toujours présente', () => {
    for (const level of ASSERTIVENESS) {
      const p = prompt({ assertiveness: level });
      expect(p).toContain(ASSERTIVENESS_RULES[level]);
      for (const other of ASSERTIVENESS.filter(l => l !== level)) expect(p).not.toContain(ASSERTIVENESS_RULES[other]);
      expect(p).toContain(ASSERTIVENESS_FACTS_RULE);
    }
  });

  it('anti-invention : la règle du CV ciblé est reprise mot pour mot, plus les réponses comme source', () => {
    const p = prompt();
    const ciblé = buildCvPrompt({ profile, entries, jobOfferText: 'Assistante commerciale.', options: { now: NOW } });
    const rule = /- Aucun chiffre, pourcentage, outil[^\n]*/.exec(ciblé)![0];
    expect(p).toContain(rule.replace(/l'annonce/g, 'la cible'));
    expect(p).toContain(`### Anti-invention (règle absolue)\n${ANSWERS_AS_SOURCE_RULE}`);
    expect(p).toContain('"suggestedEntries" DOIT être un tableau vide');
  });

  it('pages et langue viennent des réponses', () => {
    expect(prompt({ pages: 2 })).toContain('Pages cibles : 2');
    expect(prompt({ language: 'en' })).toContain('Langue du CV : en');
  });
});

describe('garde-fou : les réponses du candidat comptent comme source', () => {
  const response = { entries: [{ id: 'e1', visible: true, description: '- Réduire les retards de livraison de 15 % en réorganisant le suivi des commandes' }], suggestedEntries: [] };
  const ctx = { entries, profile, now: NOW, pageBudget: 1 };

  it('un chiffre donné dans les réponses n\'est plus signalé comme inventé', () => {
    const without = guardAiCv(response, ctx);
    expect(without.report.errors.map(e => e.code)).toContain('invented-number');
    const withAnswers = guardAiCv(response, { ...ctx, candidateAnswers: candidateAnswersText(intent()) });
    expect(withAnswers.report.errors.map(e => e.code)).not.toContain('invented-number');
  });

  it('« Ce que vous ne voulez plus faire » n\'est pas une source de faits', () => {
    expect(candidateAnswersText(intent({ avoid: 'Gérer 300 appels par jour' }))).not.toContain('300');
  });

  it('les réponses ne permettent pas d\'ajouter une entrée au profil', () => {
    const r = guardAiCv(
      { entries: [], suggestedEntries: [{ entryType: 'experience', title: 'Réorganisation du suivi des commandes' }] },
      { ...ctx, candidateAnswers: candidateAnswersText(intent()) },
    );
    expect(r.data.suggestedEntries).toEqual([]);
  });
});
