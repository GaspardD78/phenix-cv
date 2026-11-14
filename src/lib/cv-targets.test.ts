import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_TARGET_SHEETS, FIRST_READERS, TARGET_TYPES, atsEnabledFor, atsLevelFor, buildSheetOverride, describeTarget, equivalenceLines, parseEquivalenceLines, setSheetOverride, splitLines, wordingModeFor, defaultFocusFor, parseSheetOverrides,
  resetSheet, resolveTarget, serializeSheetOverrides, sheetFor, titleRuleFor,
} from './cv-targets';
import { resolveBulletFocus } from './cv-focus-rules';
import { PROFILE_SETTING_NAMES } from './profile-settings';

describe('fiches par défaut', () => {
  it('une fiche par type, sans donnée dans les listes vides', () => {
    expect(Object.keys(DEFAULT_TARGET_SHEETS).sort()).toEqual([...TARGET_TYPES].sort());
    for (const type of TARGET_TYPES) expect(DEFAULT_TARGET_SHEETS[type].type).toBe(type);
  });

  it('orientation, ATS et règle de titre par type', () => {
    const table = Object.fromEntries(TARGET_TYPES.map(t => {
      const s = DEFAULT_TARGET_SHEETS[t];
      return [t, [s.focusParDefaut, s.ats, s.titreParDefaut]];
    }));
    expect(table).toEqual({
      services: ['resultats', true, 'profile+keyword'],
      'grand-groupe': ['missions', true, 'profile'],
      'eti-pme': ['missions', false, 'profile+keyword'],
      startup: ['resultats', false, 'profile+keyword'],
      public: ['missions', false, 'equivalence'],
      associatif: ['missions', false, 'equivalence'],
    });
  });

  it('avoidTerms : uniquement des mots détectables, vides sauf public et associatif', () => {
    for (const t of TARGET_TYPES) {
      for (const term of DEFAULT_TARGET_SHEETS[t].avoidTerms) expect(term.trim().split(/\s+/).length).toBeLessThanOrEqual(2);
    }
    expect(DEFAULT_TARGET_SHEETS.public.avoidTerms).toEqual([
      'business', 'KPI', 'deal', 'pipeline', 'churn', 'growth', 'upsell', 'leads', 'closing',
    ]);
    expect(DEFAULT_TARGET_SHEETS.associatif.avoidTerms).toEqual(['business', 'deal', 'KPI', 'closing']);
    for (const t of ['services', 'grand-groupe', 'eti-pme', 'startup'] as const) expect(DEFAULT_TARGET_SHEETS[t].avoidTerms).toEqual([]);
  });

  it('les consignes d\'évitement non détectables restent en texte', () => {
    expect(DEFAULT_TARGET_SHEETS.services.eviter).toContain('vocabulaire trop interne à une seule entreprise');
    expect(DEFAULT_TARGET_SHEETS['eti-pme'].eviter).toEqual(['hyper-spécialisation', 'sigles propres aux grands groupes']);
    expect(DEFAULT_TARGET_SHEETS.startup.eviter).toEqual(['formalisme', 'process lourds']);
    expect(DEFAULT_TARGET_SHEETS.associatif.eviter).toEqual(['registre commercial agressif']);
  });

  it('équivalences du public', () => {
    const eq = Object.fromEntries(DEFAULT_TARGET_SHEETS.public.vocabulaire.equivalences.map(e => [e.from, e.to]));
    expect(eq['manager']).toBe('responsable de service');
    expect(eq['team leader']).toBe("responsable d'équipe");
    expect(eq['business developer']).toBe('chargé de développement');
    expect(eq['client']).toBe('usager');
    expect(eq['KPI']).toBe('indicateurs de suivi');
    expect(eq['deadline']).toBe('échéance');
  });

  it('compléments de fiches, photo et champs du public', () => {
    expect(DEFAULT_TARGET_SHEETS.services.attentes).toEqual(expect.arrayContaining(['adaptation à des clients et des contextes variés', 'respect des délais et des engagements']));
    expect(DEFAULT_TARGET_SHEETS.services.valorise).toEqual(expect.arrayContaining(['respect des délais', 'relation avec les clients']));
    expect(DEFAULT_TARGET_SHEETS['grand-groupe'].valorise).toEqual(expect.arrayContaining(['travail en transverse', 'mobilité interne']));
    expect(DEFAULT_TARGET_SHEETS['grand-groupe'].affichage.photo).toBe('indifferent');
    expect(DEFAULT_TARGET_SHEETS.public.valorise).toEqual(expect.arrayContaining(['concours et formations', 'relation avec les usagers', 'égalité de traitement']));
    expect(DEFAULT_TARGET_SHEETS.public.affichage.photo).toBe('non');
    expect(DEFAULT_TARGET_SHEETS.public.publicFields).toEqual({ frenchOnly: true, savoirs: true });
    expect(DEFAULT_TARGET_SHEETS.services.publicFields).toBeUndefined();
  });

  it('une fiche « equivalence » ne contient pas de terme évité dans ses propres termes privilégiés', () => {
    for (const t of ['public', 'associatif'] as const) {
      const sheet = DEFAULT_TARGET_SHEETS[t];
      const avoid = sheet.avoidTerms.map(a => a.toLowerCase());
      for (const p of sheet.vocabulaire.privilegier) expect(avoid.some(a => p.toLowerCase().includes(a))).toBe(false);
      for (const e of sheet.vocabulaire.equivalences) expect(avoid.some(a => e.to.toLowerCase().includes(a))).toBe(false);
    }
  });
});

describe('resolveTarget : explicite > détecté > défaut', () => {
  it('tout en auto, rien détecté : aucune fiche, annonce (prompt inchangé)', () => {
    const r = resolveTarget({ type: 'auto', intent: 'auto', firstReader: 'auto' });
    expect(r).toEqual({ type: null, intent: 'annonce', firstReader: null, sheet: null, sources: { type: 'default', intent: 'default', firstReader: 'default' } });
    expect(resolveTarget(undefined)).toEqual(r);
  });

  it('la détection s\'applique quand le choix est auto', () => {
    const r = resolveTarget({ type: 'auto' }, {}, { type: 'public', intent: 'annonce' });
    expect(r.type).toBe('public');
    expect(r.sources.type).toBe('detected');
    expect(r.sheet?.type).toBe('public');
  });

  it('le choix explicite l\'emporte sur la détection, axe par axe', () => {
    const r = resolveTarget({ type: 'services', intent: 'auto' }, {}, { type: 'public', intent: 'spontanee', firstReader: 'rh' });
    expect(r.type).toBe('services');
    expect(r.sources).toEqual({ type: 'explicit', intent: 'detected', firstReader: 'detected' });
    expect(r.intent).toBe('spontanee');
    expect(r.firstReader).toBe('rh');
  });

  it('valeurs inconnues ignorées', () => {
    const r = resolveTarget({ type: 'n/a' as never, intent: 'x' as never }, {}, { type: 'zzz' as never });
    expect(r.type).toBeNull();
    expect(r.intent).toBe('annonce');
  });

  it('note du lecteur et détails du public', () => {
    const r = resolveTarget({ type: 'public', readerNote: '  dimensionnement, délais  ', publicDetails: { categorie: 'B', filiere: ' administrative ' } });
    expect(r.readerNote).toBe('dimensionnement, délais');
    expect(r.publicDetails).toEqual({ categorie: 'B', filiere: 'administrative' });
    const notPublic = resolveTarget({ type: 'services', publicDetails: { categorie: 'A' } });
    expect(notPublic.publicDetails).toBeUndefined();
  });

  it('utilise les surcharges du profil', () => {
    const r = resolveTarget({ type: 'services' }, { services: { focusParDefaut: 'missions' } });
    expect(r.sheet?.focusParDefaut).toBe('missions');
    expect(r.sheet?.label).toBe(DEFAULT_TARGET_SHEETS.services.label);
  });
});

describe('défauts dérivés de la cible', () => {
  it('defaultFocusFor alimente resolveBulletFocus sous le réglage du profil', () => {
    const services = resolveTarget({ type: 'services' });
    expect(defaultFocusFor(services)).toBe('resultats');
    expect(resolveBulletFocus({}, undefined, defaultFocusFor(services))).toBe('resultats');
    expect(resolveBulletFocus({}, 'missions', defaultFocusFor(services))).toBe('missions');
    expect(defaultFocusFor(resolveTarget({}))).toBeUndefined();
    expect(resolveBulletFocus({}, undefined, defaultFocusFor(resolveTarget({})))).toBe('missions');
  });

  it('titleRuleFor : règle de la fiche, historique sans fiche', () => {
    expect(titleRuleFor(resolveTarget({ type: 'public' }))).toBe('equivalence');
    expect(titleRuleFor(resolveTarget({ type: 'grand-groupe' }))).toBe('profile');
    expect(titleRuleFor(resolveTarget({}))).toBe('profile+keyword');
  });

  it('atsLevelFor : trois niveaux selon l\'intention et la fiche', () => {
    for (const type of TARGET_TYPES) {
      const ats = DEFAULT_TARGET_SHEETS[type].ats;
      expect(atsLevelFor(resolveTarget({ type, intent: 'annonce' }))).toBe(ats ? 'strict' : 'off');
      expect(atsLevelFor(resolveTarget({ type, intent: 'spontanee' }))).toBe(ats ? 'leger' : 'off');
      for (const intent of ['recommandation', 'mobilite-interne', 'chasseur'] as const) {
        expect(atsLevelFor(resolveTarget({ type, intent }))).toBe('off');
      }
    }
  });

  it('atsLevelFor : sans fiche, strict en annonce (historique), off en spontanée', () => {
    expect(atsLevelFor(resolveTarget({}))).toBe('strict');
    expect(atsLevelFor(resolveTarget({ intent: 'spontanee' }))).toBe('off');
  });

  it('atsLevelFor : le lecteur garde la priorité', () => {
    expect(atsLevelFor(resolveTarget({ type: 'public', firstReader: 'ats' }))).toBe('strict');
    expect(atsLevelFor(resolveTarget({ type: 'public', intent: 'spontanee', firstReader: 'ats' }))).toBe('leger');
    expect(atsLevelFor(resolveTarget({ type: 'services', firstReader: 'operationnel' }))).toBe('off');
    expect(atsLevelFor(resolveTarget({ type: 'services', intent: 'spontanee', firstReader: 'direction' }))).toBe('off');
    expect(atsLevelFor(resolveTarget({ type: 'services', firstReader: 'rh' }))).toBe('strict');
    expect(atsLevelFor(resolveTarget({ type: 'services', intent: 'recommandation', firstReader: 'ats' }))).toBe('off');
    expect(atsEnabledFor(resolveTarget({ type: 'services', intent: 'spontanee' }))).toBe(true);
    expect(atsEnabledFor(resolveTarget({ type: 'services', intent: 'recommandation' }))).toBe(false);
    expect(FIRST_READERS).toHaveLength(4);
  });

  it('wordingModeFor : annonce / cible', () => {
    expect(wordingModeFor(resolveTarget({}), 'texte')).toBe('annonce');
    expect(wordingModeFor(resolveTarget({ intent: 'spontanee' }), 'texte')).toBe('cible');
    expect(wordingModeFor(resolveTarget({ intent: 'recommandation' }), '')).toBe('cible');
    expect(wordingModeFor(resolveTarget({ intent: 'chasseur' }), 'poste décrit')).toBe('annonce');
    expect(wordingModeFor(resolveTarget({ intent: 'mobilite-interne' }), '  ')).toBe('cible');
  });

  it('« transmis par » n\'est gardé que pour une recommandation', () => {
    expect(resolveTarget({ intent: 'recommandation', referrerName: ' Alex ' }).referrerName).toBe('Alex');
    expect(resolveTarget({ intent: 'spontanee', referrerName: 'Alex' }).referrerName).toBeUndefined();
    expect(resolveTarget({ referrerName: 'Alex' }).referrerName).toBeUndefined();
    const r = resolveTarget({ readerName: ' Camille ', readerRole: ' directeur ' });
    expect(r.readerName).toBe('Camille');
    expect(r.readerRole).toBe('directeur');
  });

  it('le formulaire de cible est nettoyé', () => {
    const r = resolveTarget({ brief: { company: ' Orga ', positions: ['A', ' ', 'B'], strengths: [] } });
    expect(r.brief).toEqual({ company: 'Orga', positions: ['A', 'B'] });
    expect(resolveTarget({ brief: { company: ' ' } }).brief).toBeUndefined();
  });
});

describe('fiches personnalisées par profil', () => {
  it('fusionne champ par champ, sous-objets compris', () => {
    const sheet = sheetFor('public', { public: { ats: true, vocabulaire: { registre: 'autre' }, affichage: { photo: 'indifferent' } } });
    expect(sheet.ats).toBe(true);
    expect(sheet.vocabulaire.registre).toBe('autre');
    expect(sheet.vocabulaire.equivalences).toEqual(DEFAULT_TARGET_SHEETS.public.vocabulaire.equivalences);
    expect(sheet.affichage.photo).toBe('indifferent');
    expect(sheet.affichage.longueur).toBe(DEFAULT_TARGET_SHEETS.public.affichage.longueur);
    expect(sheet.publicFields).toEqual({ frenchOnly: true, savoirs: true });
  });

  it('lecture tolérante : JSON invalide, types incorrects, champs inconnus', () => {
    expect(parseSheetOverrides(null)).toEqual({});
    expect(parseSheetOverrides('pas du json')).toEqual({});
    expect(parseSheetOverrides('[]')).toEqual({});
    const parsed = parseSheetOverrides(JSON.stringify({
      services: { ats: 'oui', focusParDefaut: 'missions', titreParDefaut: 'nope', attentes: ['a', 1, ' b '], inconnu: 1 },
      zzz: { ats: true },
      public: { vocabulaire: { equivalences: [{ from: 'x', to: 'y' }, { from: '', to: 'z' }] } },
    }));
    expect(parsed).toEqual({
      services: { focusParDefaut: 'missions', attentes: ['a', 'b'] },
      public: { vocabulaire: { equivalences: [{ from: 'x', to: 'y' }] } },
    });
  });

  it('aller-retour JSON et retour aux valeurs par défaut', () => {
    const overrides = { services: { ats: false }, startup: { focusParDefaut: 'missions' as const } };
    expect(parseSheetOverrides(serializeSheetOverrides(overrides))).toEqual(overrides);
    expect(resetSheet(overrides, 'services')).toEqual({ startup: { focusParDefaut: 'missions' } });
    expect(sheetFor('services', resetSheet(overrides, 'services'))).toEqual(DEFAULT_TARGET_SHEETS.services);
  });

  it('le réglage suit la sauvegarde par profil', () => {
    expect(PROFILE_SETTING_NAMES).toContain('cv_target_sheets');
  });
});

describe('libellé du ciblage', () => {
  it('describeTarget : axes résolus, « auto » sinon', () => {
    expect(describeTarget(resolveTarget({ type: 'public', intent: 'annonce', firstReader: 'rh' }))).toBe('Fonction publique · Annonce · RH');
    expect(describeTarget(resolveTarget({}))).toBe('type auto · Annonce · lecteur auto');
    expect(describeTarget(resolveTarget({ type: 'services', intent: 'spontanee', firstReader: 'ats' }))).toBe('Société de services · Candidature spontanée · Tri automatique');
  });
});

describe('édition des fiches : seuls les champs modifiés sont stockés', () => {
  const eff = (type: keyof typeof DEFAULT_TARGET_SHEETS) => DEFAULT_TARGET_SHEETS[type];

  it('rien ne diffère : aucune surcharge', () => {
    expect(buildSheetOverride('services', eff('services'))).toBeUndefined();
    expect(setSheetOverride({ services: { ats: false } }, 'services', eff('services'))).toEqual({});
  });

  it('un champ modifié : seulement celui-là', () => {
    const o = buildSheetOverride('services', { ...eff('services'), eviter: ['autre'], affichage: { ...eff('services').affichage, photo: 'non' } });
    expect(o).toEqual({ eviter: ['autre'], affichage: { photo: 'non' } });
    const v = buildSheetOverride('public', { ...eff('public'), vocabulaire: { ...eff('public').vocabulaire, registre: 'autre' } });
    expect(v).toEqual({ vocabulaire: { registre: 'autre' } });
  });

  it('ne touche pas aux autres types', () => {
    const next = setSheetOverride({ startup: { ats: true } }, 'services', { ...eff('services'), ats: false });
    expect(next).toEqual({ startup: { ats: true }, services: { ats: false } });
  });

  it('lignes et équivalences', () => {
    expect(splitLines(' a \n\n b\n')).toEqual(['a', 'b']);
    expect(parseEquivalenceLines('prospection → recherche de candidats\npipeline -> vivier\nincomplet →\n')).toEqual([
      { from: 'prospection', to: 'recherche de candidats' }, { from: 'pipeline', to: 'vivier' },
    ]);
    expect(equivalenceLines([{ from: 'a', to: 'b' }])).toBe('a → b');
  });
});

describe('règle de titre choisie pour ce CV', () => {
  it('le choix manuel l\'emporte sur la fiche', () => {
    expect(titleRuleFor(resolveTarget({ type: 'public', titleRule: 'free' }))).toBe('free');
    expect(titleRuleFor(resolveTarget({ type: 'public' }))).toBe('equivalence');
    expect(titleRuleFor(resolveTarget({ titleRule: 'profile' }))).toBe('profile');
    expect(titleRuleFor(resolveTarget({}))).toBe('profile+keyword');
  });
  it('règle inconnue ignorée', () => {
    expect(resolveTarget({ titleRule: 'zzz' as never }).titleRule).toBeUndefined();
  });
});
