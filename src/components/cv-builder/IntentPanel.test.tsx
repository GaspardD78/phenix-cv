import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
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

describe('IntentPanel : l\'IA d\'abord, sans IA en second', () => {
  it('« Rédiger avec l\'IA » est le bouton principal, avant l\'accès aux IA puis « Composer sans IA »', () => {
    const html = decode(render());
    const ai = html.indexOf('data-testid="intent-use-ai"');
    const sites = html.indexOf('data-testid="ai-site-links"');
    const noAi = html.indexOf('data-testid="intent-without-ai"');
    expect(ai).toBeGreaterThan(-1);
    expect(sites).toBeGreaterThan(ai);
    expect(noAi).toBeGreaterThan(sites);
    expect(html).toContain("Rédiger avec l'IA");
    expect(html).toContain('Composer sans IA');
    for (const label of ['Ouvrir ChatGPT', 'Ouvrir Claude', 'Ouvrir Gemini']) expect(html).toContain(label);
    // Le bouton principal porte le style principal ; l'option sans IA est secondaire.
    const aiButton = html.slice(html.lastIndexOf('<button', ai), html.indexOf('>', ai));
    expect(aiButton).toContain('bg-amber-500');
    const noAiButton = html.slice(html.lastIndexOf('<button', noAi), html.indexOf('>', noAi));
    expect(noAiButton).not.toContain('bg-amber-500');
    expect(html).not.toContain("Aucune IA n'est nécessaire");
  });

  it('ouvert depuis l\'offre : invite à reprendre l\'intitulé du poste de l\'offre', () => {
    const plain = decode(render());
    expect(plain).not.toContain('data-testid="intent-from-offer"');
    const html = decode(renderToStaticMarkup(<IntentPanel onUseAi={() => {}} onApplied={() => {}} fromOffer />));
    expect(html).toContain('data-testid="intent-from-offer"');
    expect(html).toContain("l'intitulé du poste de l'offre");
  });
});

describe('Adapter à une offre : lien vers le CV standard sans IA', () => {
  const source = readFileSync(new URL('./AIPromptPanel.tsx', import.meta.url), 'utf8');
  it('le lien sans IA vient après la copie du texte pour l\'IA et l\'accès aux IA', () => {
    const copy = source.indexOf("'1. Copier le texte d\\'analyse'");
    const sites = source.indexOf('<AiSiteLinks />', copy);
    const link = source.indexOf('data-testid="offer-without-ai"', copy);
    expect(copy).toBeGreaterThan(-1);
    expect(sites).toBeGreaterThan(copy);
    expect(link).toBeGreaterThan(sites);
    expect(source).toContain('Composer un CV standard sans IA');
    expect(source).toContain('setIntentFromOffer(true)');
  });
});
