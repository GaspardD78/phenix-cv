import { describe, expect, it, mock } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

mock.module('@/lib/db', () => ({ getDb: () => ({}) }));

import { ImpactFlow } from './ImpactFlow';
import { BriefView } from './BriefView';
import { GapQuestionsPanel } from './GapQuestionsPanel';
import { PositioningReport } from './PositioningReport';
import { validateTargetBrief } from '@/lib/target-brief';
import { DEFAULT_INTENT } from '@/lib/cv-intent';
import { TEST_PROFILE, makeEntry } from '@/lib/test-helpers/cv-fixtures';

const NOW = new Date('2026-11-17T10:00:00Z');
const decode = (html: string) => html.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const raw = JSON.parse(readFileSync(join(import.meta.dir, '..', '..', '..', '..', 'tests', 'fixtures', 'brief', 'fiche-adv.json'), 'utf8')) as unknown;
const { brief, report } = validateTargetBrief(raw, { now: NOW });
const profile = { ...TEST_PROFILE, firstName: 'Camille', lastName: 'Martin', title: 'Assistante commerciale' };
const entries = [makeEntry('e1', 'experience', 'Assistante commerciale', { description: '- Suivre les commandes' })];

describe('étape 1 : ce que le marché attend', () => {
  const html = decode(renderToStaticMarkup(
    <ImpactFlow profile={profile} entries={entries} intent={null} offerText={'Assistante ADV (H/F)\nVotre mission'} answers={{}} onAnswer={() => {}} onChange={() => {}} />,
  ));

  it('l\'étude du marché est proposée en premier, avec l\'intitulé de l\'offre déjà rempli', () => {
    expect(html).toContain('data-stage="research"');
    expect(html).toContain('Étape 1 sur 3 · Ce que le marché attend');
    expect(html).toContain('value="Assistante ADV"');
  });

  it('une seule action principale : copier le texte de recherche ; passer la recherche est visible', () => {
    const copyAt = html.indexOf('data-testid="impact-copy-research"');
    expect(html.slice(html.lastIndexOf('<button', copyAt), html.indexOf('>', copyAt))).toContain('pc-btn-primary');
    const readAt = html.indexOf('data-testid="impact-read-research"');
    expect(html.slice(html.lastIndexOf('<button', readAt), html.indexOf('>', readAt))).toContain('pc-btn-secondary');
    expect(html).toContain('data-testid="impact-skip"');
    expect(html).toContain('Passer la recherche');
    expect(html).toContain('Sans recherche, le CV est rédigé avec le texte habituel, sans analyse du marché.');
  });

  it('confidentialité, nouvelle conversation, accès aux IA', () => {
    expect(html).toContain('Ce texte ne contient ni votre nom ni vos coordonnées');
    expect(html).toContain('nouvelle conversation');
    expect(html).toContain('data-testid="ai-site-links"');
  });

  it('CV standard : le métier et le secteur viennent des réponses du questionnaire', () => {
    const h = decode(renderToStaticMarkup(
      <ImpactFlow profile={profile} entries={entries} intent={{ ...DEFAULT_INTENT, role: 'Gestionnaire ADV', sector: 'industrie' }} offerText="" answers={{}} onAnswer={() => {}} onChange={() => {}} />,
    ));
    expect(h).toContain('value="Gestionnaire ADV"');
    expect(h).toContain('value="industrie"');
  });
});

describe('fiche affichée', () => {
  it('rubriques, confiance, sources cliquables, rappel que les sources ne vont pas dans le CV', () => {
    const html = decode(renderToStaticMarkup(<BriefView brief={brief} report={report} onChange={() => {}} onRefresh={() => {}} now={NOW} />));
    expect(html).toContain('Fiche du 17 novembre 2026 · 3 sources');
    expect(html).toContain('Gestion des commandes clients');
    expect(html).toContain('indispensable');
    expect(html).toContain('une seule source');
    expect(html).toContain('France Travail : Fiche métier (fixture)');
    expect(html).toContain('Les sources ne figurent jamais dans votre CV');
    expect(html).toContain('aria-label="Retirer « Gestion des commandes clients »"');
    expect(html).toContain('data-testid="brief-refresh"');
    expect(html).not.toContain('data-testid="brief-stale"');
  });

  it('plus de 90 jours : « à actualiser » ; un seul site : alerte', () => {
    const old = decode(renderToStaticMarkup(<BriefView brief={{ ...brief, researchedAt: '2026-06-01' }} onChange={() => {}} onRefresh={() => {}} now={NOW} />));
    expect(old).toContain('data-testid="brief-stale"');
    expect(old).toContain('Cliquez sur « Actualiser »');
    const single = decode(renderToStaticMarkup(<BriefView brief={brief} report={{ ...report, singleDomain: true, domains: ['apec.fr'] }} onChange={() => {}} onRefresh={() => {}} now={NOW} />));
    expect(single).toContain('Toutes les sources viennent d\'un seul site (apec.fr)');
  });

  it('éléments écartés par le contrôle : rapport repliable', () => {
    const r = { ...report, removed: [{ text: 'Expert SAP', reason: 'ressemble à une consigne : écarté' }], neutralized: 1, droppedSources: [{ url: 'https://www.reddit.com/x', reason: 'site exclu' }] };
    const html = decode(renderToStaticMarkup(<BriefView brief={brief} report={r} onChange={() => {}} onRefresh={() => {}} now={NOW} />));
    expect(html).toContain('1 élément écarté, 1 source écartée');
    expect(html).toContain('« Expert SAP » : ressemble à une consigne : écarté.');
  });
});

describe('questions d\'écart une par une', () => {
  const questions = [
    { key: 'a', expectation: 'ERP', text: 'Avez-vous déjà utilisé un logiciel de gestion (ERP) ?' },
    { key: 'b', expectation: 'Anglais', text: 'Avez-vous écrit à des clients en anglais ?' },
  ];
  it('première question, compteur, passer et suivant', () => {
    const html = decode(renderToStaticMarkup(<GapQuestionsPanel questions={questions} answers={{}} onAnswer={() => {}} onDone={() => {}} />));
    expect(html).toContain('Question 1 sur 2');
    expect(html).toContain('Avez-vous déjà utilisé un logiciel de gestion (ERP) ?');
    expect(html).toContain('data-testid="gap-skip"');
    expect(html).toContain('Suivant');
    expect(html).not.toContain('Terminer');
    expect(html).toContain('Répondez seulement si c\'est vrai');
  });
  it('aucune question : rien à afficher (l\'écran est sauté)', () => {
    expect(renderToStaticMarkup(<GapQuestionsPanel questions={[]} answers={{}} onAnswer={() => {}} onDone={() => {}} />)).toBe('');
  });
});

describe('rapport de positionnement et suggestions', () => {
  const data = {
    rapport: { intitule: 'Intitulé du marché', competences: 'Commandes et facturation', reformule: [{ avant: 'suivre les commandes', apres: 'gérer les commandes clients', pourquoi: 'mot du métier' }], ecarte: ['Accueil condensé : sans lien avec l\'ADV'] },
    suggestions: { motsCles: [{ terme: 'SAP', raison: 'attendu' }, { terme: 'Sage', raison: 'attendu' }], formations: [{ libelle: 'Formation ERP', raison: 'écart' }] },
  };
  it('affiche le rapport, les mots à confirmer et les formations ; rien n\'est confirmé d\'office', () => {
    const html = decode(renderToStaticMarkup(<PositioningReport data={data} confirmed={new Set(['Sage'])} refused={new Set()} onConfirm={() => {}} onRefuse={() => {}} />));
    expect(html).toContain('Pourquoi ce CV');
    expect(html).toContain('« suivre les commandes » devient « gérer les commandes clients » : mot du métier');
    expect(html).toContain('Accueil condensé');
    expect(html).toContain('aria-label="Confirmer « SAP »"');
    expect(html).toContain('Confirmé : il peut figurer dans votre CV.');
    expect(html).toContain('rien n\'est ajouté à votre CV');
    expect(html.match(/Confirmé : il peut/g)).toHaveLength(1);
  });
  it('sans rapport ni suggestion : rien', () => {
    expect(renderToStaticMarkup(<PositioningReport data={{}} confirmed={new Set()} refused={new Set()} onConfirm={() => {}} onRefuse={() => {}} />)).toBe('');
  });
});
