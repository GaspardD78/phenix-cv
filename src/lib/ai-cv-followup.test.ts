import { describe, expect, it } from 'bun:test';
import {
  AI_FOLLOW_UP_SETTING, FOLLOW_UP_ANSWERS_RULE, FOLLOW_UP_RULES, MAX_FOLLOW_UP_ANSWER_CHARS, buildFollowUpPrompt, collectFollowUps,
  diffAiCv, followUpKey, followUpSourceText, mergeAiCv, readFollowUpAnswers, toSchemaJson, withFollowUpAnswers,
} from './ai-cv-followup';
import { analyzeAiCvJson } from './ai-cv-pipeline';
import { guardAiCv } from './ai-cv-guard';
import { parseAiCvResponse, type AiCvResponse } from './ai-cv-response';
import { resolveTarget } from './cv-targets';
import { DEFAULT_INTENT } from './cv-intent';
import { TEST_PROFILE, makeEntry } from './test-helpers/cv-fixtures';

// Personne fictive : Camille Martin, assistante commerciale.
const NOW = new Date(Date.UTC(2026, 5, 15));
const profile = { ...TEST_PROFILE, firstName: 'Camille', lastName: 'Martin' };
const entries = [
  makeEntry('e1', 'experience', 'Assistante commerciale', {
    subtitle: 'Organisation A', startDate: '2019-03', isCurrent: true,
    description: '- Suivre les commandes des clients\n- Rédiger les devis avec les commerciaux',
  }),
  makeEntry('e2', 'experience', 'Hôtesse d\'accueil', {
    subtitle: 'Organisation B', startDate: '2016-09', endDate: '2019-02', description: '- Accueillir les visiteurs\n- Gérer le standard',
  }),
  makeEntry('s1', 'skill', 'Relation client'),
];
const ctx = { entries, profile, now: NOW, pageBudget: 1 };

/** Première réponse de l'IA : un chiffre inventé, une question, un écart. */
const FIRST = {
  schemaVersion: 2,
  analyse: { langue_annonce: 'fr', indispensables: ['Suivi des commandes', 'SAP'], importants: [], correspondances: [{ exigence: 'Suivi des commandes', entryId: 'e1' }], ecarts: ['SAP'] },
  title: 'Assistante commerciale',
  summary: 'Assistante commerciale avec 9 ans d\'expérience en suivi des commandes et relation client.',
  entries: [
    { id: 'e1', visible: true, description: '- Suivre les commandes de 40 clients\n- Rédiger les devis avec les commerciaux' },
    { id: 'e2', visible: true },
    { id: 's1', visible: true },
  ],
  suggestedEntries: [],
  warnings: ['Combien de clients suiviez-vous chez Organisation A ?'],
};

const first = () => {
  const a = analyzeAiCvJson(JSON.stringify(FIRST), ctx);
  if (!a.ok) throw new Error(a.error);
  return a;
};

describe('collectFollowUps : les remarques deviennent des questions', () => {
  it('questions de l\'IA, exigences non couvertes, puis points à vérifier, sans doublon', () => {
    const { report } = first();
    const qs = collectFollowUps(report);
    expect(qs.map(q => q.kind)).toEqual(['question', 'ecart', 'verification']);
    expect(qs[0].text).toBe('Combien de clients suiviez-vous chez Organisation A ?');
    expect(qs[1].text).toContain('« SAP »');
    expect(qs[2].text).toContain('40');
    expect(qs[2].text).toContain('Est-ce exact ?');
    const doubled = collectFollowUps({ ...report, aiWarnings: [...report.aiWarnings, ...report.aiWarnings] });
    expect(doubled).toHaveLength(qs.length);
  });

  it('clé stable : la même question retrouve sa réponse d\'une analyse à l\'autre', () => {
    expect(collectFollowUps(first().report)[0].key).toBe(followUpKey('question', 'Combien de clients suiviez-vous chez Organisation A ?'));
  });

  it('rapport sans remarque : aucune question', () => {
    const clean = analyzeAiCvJson(JSON.stringify({ entries: [{ id: 'e1', visible: true }], suggestedEntries: [] }), ctx);
    expect(clean.ok && collectFollowUps(clean.report)).toEqual([]);
  });
});

describe('réponses enregistrées dans le CV (cv.settings.aiFollowUp)', () => {
  it('relecture identique, réponses vides retirées, autres réglages conservés', () => {
    const settings = withFollowUpAnswers({ showPhoto: false }, { a: ' 40 clients ', b: '   ' });
    expect(settings.showPhoto).toBe(false);
    expect(settings[AI_FOLLOW_UP_SETTING]).toEqual({ answers: { a: '40 clients' } });
    expect(readFollowUpAnswers(settings)).toEqual({ a: '40 clients' });
  });
  it('valeurs inattendues ignorées, longueur limitée', () => {
    expect(readFollowUpAnswers({ aiFollowUp: { answers: { a: 3, b: 'x'.repeat(MAX_FOLLOW_UP_ANSWER_CHARS + 10) } } }).b).toHaveLength(MAX_FOLLOW_UP_ANSWER_CHARS);
    expect(readFollowUpAnswers({ aiFollowUp: 'x' })).toEqual({});
    expect(readFollowUpAnswers(null)).toEqual({});
  });
  it('les réponses sont une source pour le garde-fou', () => {
    expect(followUpSourceText({ a: '40 clients', b: ' ' })).toBe('40 clients');
  });
});

describe('prompt de la seconde passe', () => {
  const { data, report } = first();
  const questions = collectFollowUps(report);
  const answers = { [questions[0].key]: 'Environ 40 clients, surtout des PME' };
  const offer = () => buildFollowUpPrompt({
    profile, entries, current: data, questions, answers,
    mode: { kind: 'offer', jobOfferText: 'Assistante commerciale. Suivi des commandes, SAP.', target: resolveTarget(undefined) },
    options: { now: NOW },
  });

  it('instantané : réponse à une annonce', () => {
    expect(offer()).toMatchSnapshot();
  });

  it('contient la première version, chaque question avec sa réponse ou « (sans réponse) », et les règles', () => {
    const p = offer();
    expect(p).toContain('## Première version du CV (JSON, déjà contrôlée)');
    expect(p).toContain('"langue_annonce": "fr"');
    expect(p).toContain('Réponse : Environ 40 clients, surtout des PME');
    expect(p.match(/Réponse : \(sans réponse\)/g)).toHaveLength(questions.length - 1);
    expect(p).toContain(FOLLOW_UP_RULES);
    expect(p).toContain(`### Anti-invention (règle absolue)\n${FOLLOW_UP_ANSWERS_RULE}`);
    expect(p).toContain('Annonce :\n<<<');
  });

  it('CV standard : même seconde passe, avec les réponses au questionnaire et le niveau d\'affirmation', () => {
    const p = buildFollowUpPrompt({
      profile, entries, current: data, questions, answers,
      mode: { kind: 'generic', intent: { ...DEFAULT_INTENT, role: 'Assistante commerciale', assertiveness: 'affirme' } },
      options: { now: NOW },
    });
    expect(p).toContain('coach de carrière');
    expect(p).toContain('## Cible : ce que le candidat recherche');
    expect(p).toContain("## Niveau d'affirmation : Affirmé");
    expect(p).not.toContain('Annonce :');
  });

  it('la première version relue par l\'application donne le même CV (aller-retour sans perte)', () => {
    const again = guardAiCv(parseAiCvResponse(toSchemaJson(data)), ctx).data;
    expect(again.entries).toEqual(data.entries);
    expect(again.title).toBe(data.title);
    expect(again.summary).toBe(data.summary);
    expect(again.analyse?.ecarts).toEqual(data.analyse?.ecarts);
  });
});

describe('changements et version finale', () => {
  const before: AiCvResponse = {
    title: 'Assistante commerciale', summary: 'Ancienne accroche.', suggestedEntries: [{ entryType: 'skill', title: 'Négociation' }],
    entries: [{ id: 'e1', visible: true, description: '- Ancienne puce' }, { id: 'e2', visible: true }],
    warnings: ['Question 1'],
  };
  const after: AiCvResponse = {
    title: 'Assistante commerciale', summary: 'Nouvelle accroche.', suggestedEntries: [],
    entries: [{ id: 'e1', visible: true, description: '- Nouvelle puce' }, { id: 'e2', visible: false }, { id: 's1', visible: true, titleOverride: 'Relation clients' }],
    cvSkills: [{ name: 'Suivi des commandes', sources: ['e1'] }],
    warnings: [],
  };

  it('diffAiCv : un changement par élément, avec avant et après lisibles', () => {
    const changes = diffAiCv(before, after, entries);
    expect(changes.map(c => c.key)).toEqual(['summary', 'entry:e1:description', 'entry:e2:visible', 'entry:s1:titleOverride', 'cvSkills']);
    expect(changes.find(c => c.key === 'entry:e2:visible')).toMatchObject({ label: 'Hôtesse d\'accueil : affichage', before: 'Affichée', after: 'Masquée' });
    expect(changes.find(c => c.key === 'cvSkills')).toMatchObject({ before: '(rien)', after: 'Suivi des commandes' });
    expect(diffAiCv(before, structuredClone(before), entries)).toEqual([]);
  });

  it('mergeAiCv : seuls les changements cochés passent, le reste de la première version est conservé', () => {
    const merged = mergeAiCv(before, after, new Set(['entry:e1:description', 'cvSkills']));
    expect(merged.summary).toBe('Ancienne accroche.');
    expect(merged.entries).toEqual([{ id: 'e1', visible: true, description: '- Nouvelle puce' }, { id: 'e2', visible: true }]);
    expect(merged.cvSkills).toEqual(after.cvSkills);
    // Questions restantes : celles de la seconde version ; suggestions : celles de la première.
    expect(merged.warnings).toEqual([]);
    expect(merged.suggestedEntries).toEqual(before.suggestedEntries);
    // La première version n'est pas modifiée.
    expect(before.entries[0].description).toBe('- Ancienne puce');
  });

  it('mergeAiCv : rien de coché, rien ne change ; tout coché, la seconde version', () => {
    const none: AiCvResponse = { ...mergeAiCv(before, after, new Set()), warnings: before.warnings };
    expect(none).toEqual(before);
    const all = mergeAiCv(before, after, new Set(diffAiCv(before, after, entries).map(c => c.key)));
    expect(all.summary).toBe(after.summary);
    expect(all.entries).toEqual(after.entries);
  });
});

describe('parcours complet : réponses, seconde passe, même garde-fou, choix', () => {
  it('un chiffre confirmé par le candidat passe, un chiffre inventé par la seconde passe reste bloqué', () => {
    const { data, report } = first();
    expect(report.errors.map(e => e.code)).toContain('invented-number');
    const questions = collectFollowUps(report);
    const answers = { [questions[0].key]: 'Je suivais 40 clients' };
    const candidateAnswers = followUpSourceText(answers);

    const second = {
      ...FIRST,
      summary: 'Assistante commerciale avec 9 ans d\'expérience, au suivi des commandes de 40 clients.',
      entries: [{ id: 'e1', visible: true, description: '- Suivre les commandes de 40 clients\n- Rédiger 300 devis par an' }, { id: 'e2', visible: false }, { id: 's1', visible: true }],
      warnings: [],
    };
    const analysis = analyzeAiCvJson(JSON.stringify(second), { ...ctx, candidateAnswers });
    expect(analysis.ok).toBe(true);
    if (!analysis.ok) return;
    const invented = analysis.report.errors.filter(e => e.code === 'invented-number').map(e => e.message).join('\n');
    expect(invented).toContain('300');
    expect(invented).not.toContain('40');

    // Le candidat garde l'accroche et le masquage, pas les puces.
    const changes = diffAiCv(data, analysis.data, entries);
    const merged = mergeAiCv(data, analysis.data, new Set(['summary', 'entry:e2:visible']));
    expect(changes.map(c => c.key)).toEqual(expect.arrayContaining(['summary', 'entry:e1:description', 'entry:e2:visible']));
    expect(merged.entries.find(e => e.id === 'e1')?.description).toBe(data.entries.find(e => e.id === 'e1')?.description);

    // La version finale repasse par le même garde-fou avant l'application.
    const final = analyzeAiCvJson(toSchemaJson(merged), { ...ctx, candidateAnswers });
    expect(final.ok && final.report.errors.map(e => e.code)).not.toContain('invented-number');
    expect(final.ok && final.data.entries.find(e => e.id === 'e2')?.visible).toBe(false);
  });
});
