import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiFollowUpPanel } from './AiFollowUpPanel';
import { analyzeAiCvJson } from '../../lib/ai-cv-pipeline';
import { collectFollowUps } from '../../lib/ai-cv-followup';
import { TEST_PROFILE, makeEntry } from '../../lib/test-helpers/cv-fixtures';

// Personne fictive : Camille Martin, assistante commerciale.
const entries = [makeEntry('e1', 'experience', 'Assistante commerciale', { startDate: '2020-01', isCurrent: true, description: '- Suivre les commandes' })];
const ctx = { entries, profile: TEST_PROFILE, now: new Date(Date.UTC(2026, 5, 15)), pageBudget: 1 };
const first = analyzeAiCvJson(JSON.stringify({
  analyse: { indispensables: ['SAP'], importants: [], correspondances: [], ecarts: ['SAP'] },
  entries: [{ id: 'e1', visible: true, description: '- Suivre les commandes de 40 clients' }],
  suggestedEntries: [], warnings: ['Combien de clients suiviez-vous ?'],
}), ctx);
if (!first.ok) throw new Error(first.error);

describe('AiFollowUpPanel : écran de réponse aux remarques', () => {
  it('une case de réponse par question, avec son type, et rien d\'appliqué avant collage', () => {
    const questions = collectFollowUps(first.report);
    const html = renderToStaticMarkup(
      <AiFollowUpPanel report={first.report} first={first.data} entries={entries} initialAnswers={{ [questions[0].key]: 'Environ 40' }}
        buildPrompt={() => ''} analyze={raw => analyzeAiCvJson(raw, ctx)} onSaveAnswers={() => {}} onUseVersion={() => {}} onClose={() => {}} />,
    ).replace(/&#x27;/g, "'");
    expect(html.match(/<textarea id="follow-up-\d+"/g)).toHaveLength(questions.length);
    for (const label of ["Question de l'IA", 'Exigence non couverte', 'Point à vérifier']) expect(html).toContain(label);
    expect(html).toContain('>Environ 40</textarea>');
    expect(html).toContain(`1 réponse sur ${questions.length}`);
    expect(html).not.toContain('Utiliser cette version');
  });
});
