import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupData } from '@/lib/backup';
import { convertCvmakerBackup } from './convert';
import { applyProfileChoices, buildImportReport, dedupeEntries, profileDifferences, profileFills, restorePlan, type ExistingEntry } from './merge';

const FIXTURES = join(import.meta.dir, '..', '..', '..', 'tests', 'fixtures', 'cvmaker');
const converted = () => convertCvmakerBackup(JSON.parse(readFileSync(join(FIXTURES, 'camille-martin-recent.cvmaker'), 'utf8')) as BackupData);

/** Phénix déjà rempli : la même expérience et la même compétence, avec d'autres identifiants. */
const EXISTING: ExistingEntry[] = [
  { id: 'phx-adv', entry_type: 'experience', title: 'ASSISTANTE COMMERCIALE', subtitle: 'Négoce Rhone Matériaux', start_date: '2018-03-01' },
  { id: 'phx-xls', entry_type: 'skill', title: 'excel', subtitle: null, start_date: null },
  { id: 'phx-autre', entry_type: 'experience', title: 'Assistante commerciale', subtitle: 'Autre entreprise', start_date: '2018-03' },
];

describe('doublons d\'entrées', () => {
  it('entrée déjà présente : retirée du fichier, avec son libellé', () => {
    const { backup, duplicates } = dedupeEntries(converted().backup, EXISTING);
    expect(duplicates).toEqual([
      { incomingId: 'e-adv', existingId: 'phx-adv', label: 'Assistante commerciale (Négoce Rhône Matériaux)' },
      { incomingId: 's-xls', existingId: 'phx-xls', label: 'Excel' },
    ]);
    expect(backup.modules.master_entries!.map(e => e.id)).toEqual(['e-cab', 'f-bts', 's-cmd', 'l-en']);
  });

  it('les blocs de CV et les réglages qui y renvoient pointent vers l\'entrée déjà présente', () => {
    const source = converted().backup;
    source.modules.cv_documents![0].settings = JSON.stringify({ cvIntent: { preferences: { 'e-adv': 'prefer' } } });
    const { backup } = dedupeEntries(source, EXISTING);
    expect(backup.modules.cv_blocks!.find(b => b.id === 'b-adv')!.entry_id).toBe('phx-adv');
    expect(String(backup.modules.cv_documents![0].settings)).toBe('{"cvIntent":{"preferences":{"phx-adv":"prefer"}}}');
  });

  it('même intitulé mais autre organisme ou autre début : ce n\'est pas un doublon', () => {
    const { duplicates } = dedupeEntries(converted().backup, [{ id: 'x', entry_type: 'experience', title: 'Assistante commerciale', subtitle: 'Négoce Rhône Matériaux', start_date: '2019-01' }]);
    expect(duplicates).toEqual([]);
  });

  it('rien à dédoublonner : la sauvegarde est rendue telle quelle', () => {
    const source = converted().backup;
    expect(dedupeEntries(source, []).backup).toBe(source);
  });
});

describe('profil : rien n\'est remplacé sans votre choix', () => {
  const current = { first_name: 'Camille', last_name: 'Martin', title: 'Assistante ADV', email: 'camille.martin@example.com', phone: null, other_url: 'https://camille-martin.example', photo_path: null, header_extras: '[]' };
  const incoming = converted().backup.modules.profiles![0];

  it('différences : renseignées des deux côtés et différentes', () => {
    expect(profileDifferences(current, incoming).map(d => [d.label, d.mine, d.theirs])).toEqual([['Titre', 'Assistante ADV', 'Assistante commerciale']]);
  });

  it('champs vides dans Phénix CV : remplis par le fichier', () => {
    expect(profileFills(current, incoming)).toEqual(['Résumé', 'Téléphone', 'Ville', 'Pays', 'LinkedIn', 'Permis', 'Mentions d\'en-tête', 'Photo']);
  });

  it('garder ma valeur : retirée du fichier (la fusion ne remplace jamais par du vide)', () => {
    const b = applyProfileChoices(converted().backup, new Set(['title']));
    expect(b.modules.profiles![0].title).toBeNull();
    expect(b.modules.profiles![0].city).toBe('Lyon');
  });
});

describe('plan de restauration et rapport', () => {
  it('tout fusionner, ou tout remplacer, pour les parties présentes', () => {
    const b = converted().backup;
    expect(restorePlan(b, 'merge')).toEqual({ profile: 'merge', masterEntries: 'merge', cvDocuments: 'merge', applications: 'merge', settings: 'merge' });
    expect(restorePlan({ ...b, modules: { profiles: b.modules.profiles } }, 'replace')).toEqual({ profile: 'replace' });
  });

  it('rapport : ce qui a été importé, dédoublonné, et la liste des CV à ouvrir', () => {
    const { backup, report } = converted();
    const { backup: deduped, duplicates } = dedupeEntries(backup, EXISTING);
    const r = buildImportReport(report, deduped, duplicates, 'merge', 'sauvegardes-automatiques/avant-restauration.cvmaker');
    expect(r.lines).toEqual([
      'Vos données CVmaker ont été ajoutées à celles de Phénix CV.',
      'Profil et coordonnées repris.',
      '4 éléments de profil ajoutés (expériences, formations, compétences…).',
      '2 éléments déjà présents n\'ont pas été dupliqués.',
      '1 CV importé.',
      '1 candidature importée.',
    ]);
    expect(r.cvs).toEqual([{ id: 'cv-adv', name: 'CV ADV' }]);
    expect(r.ignored.map(i => i.label)).toEqual(['Veille emploi (1 recherche enregistrée, 1 offre sauvegardée)', 'Connexions et identifiants (Google Drive…)']);
    expect(r.autoBackupPath).toBe('sauvegardes-automatiques/avant-restauration.cvmaker');
  });
});
