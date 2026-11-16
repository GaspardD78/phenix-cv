import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntentPanel } from './IntentPanel';
import { ASSERTIVENESS_LABELS, INTENT_QUESTIONS } from '@/lib/cv-intent';

const render = () => renderToStaticMarkup(<IntentPanel onUseAi={() => {}} onApplied={() => {}} />);
const decode = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

describe('IntentPanel : questionnaire du CV standard', () => {
  // La relecture des réponses enregistrées (cv.settings.cvIntent) est couverte par readCvIntent
  // (cv-intent.test.ts) : au rendu serveur, le store garde son état initial.
  it('les sept questions numérotées et le réglage à trois valeurs, « Équilibré » par défaut', () => {
    const html = decode(render());
    Object.values(INTENT_QUESTIONS).forEach((q, i) => expect(html).toContain(`${i + 1}. ${q}`));
    for (const label of Object.values(ASSERTIVENESS_LABELS)) expect(html).toContain(label);
    expect(html).toMatch(/checked="" value="equilibre"/);
    // Pas d'exemple pré-rempli dans les questions.
    expect(html).not.toContain('placeholder="Ex.');
  });
});
