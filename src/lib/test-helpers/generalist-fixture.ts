import type { CVBlock } from '@/types/cv';
import type { EntryType, MasterEntry, Profile } from '@/types/profile';
import { makeEntry } from './cv-fixtures';

/**
 * Fixture anonymisée du cas de bout en bout « assistante commerciale généraliste » : employeurs, écoles et
 * contenus fictifs, aucune donnée réelle. Quatre postes détaillés, deux lignes à fusionner (2 puis 3 postes
 * anciens), formation, compétences en catégories, certification et centre d'intérêt à masquer.
 */

export const GENERALIST_NOW = new Date(Date.UTC(2026, 5, 15));

export const GENERALIST_PROFILE: Profile = {
  id: 'p-gen', firstName: 'Camille', lastName: 'Exemple', email: 'camille.exemple@example.com', phone: null,
  address: null, city: 'Lyon', postalCode: null, country: 'France', linkedinUrl: null, otherUrl: null,
  photoPath: null, title: 'Assistante commerciale', summary: 'Assistante commerciale polyvalente.',
  drivingLicense: 'Permis B', headerExtras: [], createdAt: '', updatedAt: '',
};

const exp = (id: string, title: string, subtitle: string, start: string, end: string | null, description: string) =>
  makeEntry(id, 'experience', title, { subtitle, startDate: start, endDate: end, isCurrent: end === null, description, profileId: 'p-gen' });

export const GENERALIST_ENTRIES: MasterEntry[] = [
  // Postes détaillés (les plus récents).
  exp('d1', 'Assistante commerciale', 'Agence Alpha', '2022-01', null,
    "- Gérer les commandes de 40 clients avec les responsables de service\n- Rédiger les devis et les contrats\n- Animer les réunions de suivi avec les équipes\n- Suivre les dossiers clients dans un logiciel de gestion"),
  exp('d2', 'Assistante commerciale', 'Groupe Beta', '2019-03', '2021-12',
    "- Accompagner les responsables dans le suivi des clients\n- Organiser des salons professionnels pour 12 entreprises\n- Former les nouveaux collègues aux outils de vente"),
  exp('d3', 'Assistante commerciale', 'Société Gamma', '2017-01', '2019-02',
    "- Gérer les commandes de bout en bout\n- Animer la relation avec les fournisseurs\n- Mettre en place des procédures de suivi"),
  exp('d4', 'Assistante de direction', 'Société Delta', '2015-06', '2016-12',
    "- Assurer le suivi administratif des dossiers\n- Préparer les réunions de direction\n- Accueillir les nouveaux collaborateurs"),
  // Ligne fusionnée n° 1 : deux postes (dates calculées : mars 2013 à mai 2015).
  exp('a1', 'Assistante commerciale (Epsilon)', 'Epsilon', '2014-01', '2015-05',
    "- Traiter les commandes de plusieurs services\n- Rédiger des comptes rendus de réunion"),
  exp('a2', 'Assistante commerciale (Zeta)', 'Zeta', '2013-03', '2013-12',
    "- Relancer les clients par téléphone\n- Planifier les rendez-vous"),
  // Ligne fusionnée n° 2 : trois postes (dates calculées : septembre 2010 à février 2013).
  exp('b1', 'Assistant administratif (Eta)', 'Eta', '2012-02', '2013-02',
    "- Assister les commerciaux dans leurs démarches\n- Tenir le tableau de suivi des commandes"),
  exp('b2', 'Assistant administratif (Theta)', 'Theta', '2011-06', '2012-01',
    "- Saisir les bons de commande\n- Trier le courrier reçu"),
  exp('b3', 'Assistant administratif (Iota)', 'Iota', '2010-09', '2011-05',
    "- Accueillir les clients\n- Classer les dossiers de facturation"),
  makeEntry('ed1', 'education', 'Master Commerce et gestion', { subtitle: 'Université fictive', startDate: '2008', endDate: '2010', profileId: 'p-gen' }),
  makeEntry('ed2', 'education', 'Licence Économie', { subtitle: 'Université fictive', startDate: '2005', endDate: '2008', profileId: 'p-gen' }),
  makeEntry('k1', 'skill', 'Vente', { description: '- Négociation\n- Rédaction de devis\n- Relation client', profileId: 'p-gen' }),
  makeEntry('k2', 'skill', 'Outils', { description: '- Logiciel de gestion\n- Tableur\n- Messagerie', profileId: 'p-gen' }),
  makeEntry('c1', 'certification', 'Sauveteur secouriste du travail', { subtitle: 'Organisme fictif', startDate: '2019', profileId: 'p-gen' }),
  makeEntry('i1', 'interest', 'Randonnée', { profileId: 'p-gen' }),
];

const HEADERS: [EntryType, string][] = [
  ['experience', 'Expériences Professionnelles'], ['education', 'Formations'], ['skill', 'Compétences'],
  ['certification', 'Certifications'], ['interest', "Centres d'intérêt"],
];

/** Blocs d'un CV fraîchement créé : un en-tête par type, puis une entrée par bloc, dans l'ordre du profil. */
export function makeGeneralistBlocks(entries: readonly MasterEntry[] = GENERALIST_ENTRIES): CVBlock[] {
  const blocks: CVBlock[] = [];
  let order = 0;
  for (const [type, label] of HEADERS) {
    const list = entries.filter(e => e.entryType === type);
    if (list.length === 0) continue;
    blocks.push({ id: `h-${type}`, cvId: 'cv-gen', entryId: null, blockType: 'section_header', sectionName: label, customContent: null, sortOrder: order++, isVisible: true, overrideData: {}, createdAt: '' });
    for (const e of list) {
      blocks.push({ id: `b-${e.id}`, cvId: 'cv-gen', entryId: e.id, blockType: 'entry_ref', sectionName: null, customContent: null, sortOrder: order++, isVisible: true, overrideData: {}, createdAt: '' });
    }
  }
  return blocks;
}

export const GENERALIST_TITLE = 'Assistante commerciale · Relation client et gestion des commandes';

export const GENERALIST_SKILL_LINES = [
  { text: 'Analyse des besoins clients et rédaction de devis', sources: ['d1'] },
  { text: 'Animation de réunions de suivi et coordination des équipes', sources: ['d1', 'd4'] },
  { text: 'Accompagnement des responsables dans le suivi des clients', sources: ['d2'] },
  { text: "Organisation d'événements professionnels", sources: ['d2'] },
  { text: 'Mise en place de procédures et suivi administratif des dossiers', sources: ['d3', 'd4'] },
  // Sources : entrées fusionnées (leurs blocs sont masqués par la fusion, la source reste valide).
  { text: 'Relance des clients et planification des rendez-vous', sources: ['a2'] },
  { text: 'Accueil des clients et suivi des dossiers de facturation', sources: ['b3'] },
];

/** Réponse de l'IA (schéma v2 additif), telle qu'une IA rigoureuse la produirait pour une annonce du secteur public. */
export function generalistResponse(overrides: { d1Description?: string } = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    analyse: {
      langue_annonce: 'fr',
      indispensables: ['Gestion de dossiers', 'Relation avec les usagers'],
      importants: ['Organisation d\'événements'],
      correspondances: [
        { exigence: 'Gestion de dossiers', entryId: 'd1' },
        { exigence: 'Relation avec les usagers', entryId: 'd2' },
      ],
      ecarts: [],
    },
    title: GENERALIST_TITLE,
    summary: "Plus de dix ans d'expérience en relation client : suivi des commandes, rédaction de devis, coordination des équipes et accompagnement des responsables.",
    header: { showDrivingLicense: true },
    entries: [
      { id: 'd1', visible: true, description: overrides.d1Description ?? "- Gérer les commandes de 40 clients avec les responsables de service\n- Rédiger les devis et les contrats\n- Animer les réunions de suivi avec les équipes\n- Suivre les dossiers clients dans un logiciel de gestion" },
      { id: 'd2', visible: true, description: "- Accompagner les responsables dans le suivi des clients\n- Organiser des salons professionnels pour 12 entreprises\n- Former les nouveaux collègues aux outils de vente" },
      { id: 'd3', visible: true, description: "- Gérer les commandes de bout en bout\n- Animer la relation avec les fournisseurs\n- Mettre en place des procédures de suivi" },
      { id: 'd4', visible: true, description: "- Assurer le suivi administratif des dossiers\n- Préparer les réunions de direction\n- Accueillir les nouveaux collaborateurs" },
      { id: 'a1', visible: true }, { id: 'a2', visible: true },
      { id: 'b1', visible: true }, { id: 'b2', visible: true }, { id: 'b3', visible: true },
      { id: 'ed1', visible: true }, { id: 'ed2', visible: true },
      { id: 'k1', visible: false }, { id: 'k2', visible: false }, { id: 'c1', visible: false }, { id: 'i1', visible: false },
    ],
    mergedEntries: [
      { ids: ['a1', 'a2'], titleOverride: 'Assistante commerciale', description: "- Traiter les commandes de plusieurs services\n- Relancer les clients et planifier les rendez-vous" },
      { ids: ['b1', 'b2', 'b3'], titleOverride: 'Assistant administratif' },
    ],
    cvSkillLines: GENERALIST_SKILL_LINES,
    sectionOrder: ['Expériences Professionnelles', 'Compétences', 'Formations'],
    suggestedEntries: [],
  };
}
