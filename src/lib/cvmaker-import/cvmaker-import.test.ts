import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupData } from '@/lib/backup';
import { CVMAKER_FIRST_BACKUP, EMPTY_BACKUP_MESSAGE, describeOrigin, detectBackupOrigin } from './detect';
import { FALLBACK_TEMPLATE_ID, PHENIX_TABLES, convertCvmakerBackup, normalizeEntryDate } from './convert';

/** Fichiers produits par le vrai code de CVmaker (tests/fixtures/cvmaker/generate.ts). */
const FIXTURES = join(import.meta.dir, '..', '..', '..', 'tests', 'fixtures', 'cvmaker');
const raw = (name: string) => readFileSync(join(FIXTURES, `${name}.cvmaker`), 'utf8');
const load = (name: string) => JSON.parse(raw(name)) as BackupData;
const recent = () => load('camille-martin-recent');
const old = () => load('camille-martin-2026-05');

describe('fichiers d\'exemple : produits par CVmaker, données fictives', () => {
  it('format de CVmaker, version « 1.0 », Camille Martin', () => {
    for (const b of [recent(), old()]) {
      expect(b.__cvmaker_backup).toBe(true);
      expect(b.version).toBe('1.0');
      expect(b.app).toBeUndefined();
      expect(b.modules.profiles![0]).toMatchObject({ first_name: 'Camille', last_name: 'Martin', email: 'camille.martin@example.com' });
    }
  });
});

describe('origine du fichier', () => {
  it('CVmaker récent : reconnu, version d\'octobre 2026 ou plus récente', () => {
    const origin = detectBackupOrigin(recent());
    expect(origin).toEqual({ app: 'cvmaker', cvmakerSince: '2026-10-29', empty: false });
    expect(describeOrigin(origin)).toBe('Sauvegarde CVmaker (version d\'octobre 2026 ou plus récente)');
  });

  it('CVmaker de mai 2026 : reconnu, daté d\'après ses colonnes', () => {
    const origin = detectBackupOrigin(old());
    expect(origin).toEqual({ app: 'cvmaker', cvmakerSince: '2026-04-14', empty: false });
    expect(describeOrigin(origin)).toBe('Sauvegarde CVmaker (version d\'avril 2026 ou plus récente)');
  });

  it('CVmaker d\'avant avril 2026 : première version à sauvegarder', () => {
    const b = old();
    b.modules.cv_documents = b.modules.cv_documents!.map(({ markdown_content: _m, markdown_mode: _n, ...rest }) => rest);
    expect(detectBackupOrigin(b).cvmakerSince).toBe(CVMAKER_FIRST_BACKUP);
    expect(describeOrigin(detectBackupOrigin(b))).toBe('Sauvegarde CVmaker (version de mars 2026 ou plus récente)');
  });

  it('Phénix CV : signé (format 2), ou ancien fichier reconnu à son lien personnel', () => {
    expect(detectBackupOrigin({ ...recent(), app: 'phenix-cv', formatVersion: 2 }).app).toBe('phenix');
    const legacy: BackupData = { __cvmaker_backup: true, version: '1.0', exportDate: '', counts: {}, modules: { profiles: [{ id: 'p', first_name: 'Camille', last_name: 'Martin', other_url: null }] } };
    expect(detectBackupOrigin(legacy)).toEqual({ app: 'phenix', cvmakerSince: null, empty: false });
  });

  it('fichier vide : rien à importer, avec un message clair', () => {
    const empty: BackupData = { __cvmaker_backup: true, version: '1.0', exportDate: '', counts: {}, modules: { settings: [{ key: 'theme', value: 'light' }] } };
    expect(detectBackupOrigin(empty)).toEqual({ app: 'inconnue', cvmakerSince: null, empty: true });
    expect(EMPTY_BACKUP_MESSAGE).toContain('rien à importer');
  });
});

describe('conversion CVmaker → Phénix CV (fichier récent)', () => {
  const { backup, report } = convertCvmakerBackup(recent());
  const serialized = JSON.stringify(backup);

  it('seules les tables connues de Phénix CV sont gardées', () => {
    for (const table of Object.keys(backup.modules)) expect(PHENIX_TABLES as readonly string[]).toContain(table);
    expect(Object.keys(backup.modules).some(t => t.startsWith('job_'))).toBe(false);
  });

  it('aucun secret : ni jetons Google, ni réglages de la veille emploi', () => {
    expect(serialized).not.toContain('FAUX');
    expect(backup.modules.settings!.map(r => r.key)).toEqual(['cv_target_pages', 'cv_personal_rules:cvm-recent']);
    expect(report.ignored).toContainEqual(expect.objectContaining({ label: 'Connexions et identifiants (Google Drive…)', count: 1 }));
    const watch = report.ignored.find(i => i.label.startsWith('Veille emploi'))!;
    expect(watch.label).toBe('Veille emploi (1 recherche enregistrée, 1 offre sauvegardée)');
    expect(watch.reason).toContain('n\'existe pas dans Phénix CV');
  });

  it('liens : le site devient le lien personnel ; le GitHub, non repris, est signalé', () => {
    const profile = backup.modules.profiles![0];
    expect(profile.other_url).toBe('https://camille-martin.example');
    expect('github_url' in profile).toBe(false);
    expect('portfolio_url' in profile).toBe(false);
    expect(report.links).toEqual({ github: 'https://github.com/camille-martin-exemple', portfolio: 'https://camille-martin.example', kept: 'https://camille-martin.example' });
    expect(report.converted.join(' ')).toContain('Votre lien GitHub (https://github.com/camille-martin-exemple) ne l\'est pas');
  });

  it('choix du GitHub : c\'est lui qui est gardé', () => {
    const { backup: b, report: r } = convertCvmakerBackup(recent(), { keepLink: 'github' });
    expect(b.modules.profiles![0].other_url).toBe('https://github.com/camille-martin-exemple');
    expect(r.converted.join(' ')).toContain('Votre lien site (https://camille-martin.example) ne l\'est pas');
  });

  it('photo, permis et mentions d\'en-tête repris tels quels', () => {
    const profile = backup.modules.profiles![0];
    expect(String(profile.photo_path)).toStartWith('data:image/png;base64,');
    expect(profile.driving_license).toBe('B');
    expect(profile.header_extras).toBe('["Disponible immédiatement"]');
  });

  it('dates « 09/2015 » ramenées au format AAAA-MM', () => {
    const cab = backup.modules.master_entries!.find(e => e.id === 'e-cab')!;
    expect([cab.start_date, cab.end_date]).toEqual(['2015-09', '2018-02']);
    expect(report.converted).toContain('2 dates mises au format de Phénix CV (par exemple « 09/2015 » devient « septembre 2015 »).');
  });

  it('compteurs et points à vérifier', () => {
    expect(report.counts).toEqual({ profiles: 1, experiences: 2, educations: 1, skills: 2, languages: 1, otherEntries: 0, cvs: 1, applications: 1 });
    expect(report.warnings).toContain('1 CV contient d\'anciennes lignes de compétences. Ouvrez-le et cliquez sur « Convertir en étiquettes » pour les relire.');
    expect(report.warnings.join(' ')).toContain('1 pièce jointe de candidature : seul le nom est repris.');
  });

  it('le fichier d\'origine n\'est pas modifié', () => {
    const source = recent();
    const before = JSON.stringify(source);
    convertCvmakerBackup(source);
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('conversion CVmaker → Phénix CV (fichier de mai 2026)', () => {
  const { backup, report } = convertCvmakerBackup(old());
  it('deux liens : le site est gardé ; pas de photo ni de permis dans cette version', () => {
    const profile = backup.modules.profiles![0];
    expect(profile.other_url).toBe('https://camille-martin.example');
    expect(profile.photo_path).toBeNull();
    expect('driving_license' in profile).toBe(false);
    expect(report.warnings.join(' ')).not.toContain('photo');
    expect(JSON.stringify(backup)).not.toContain('FAUX');
  });
  it('pas de table cv_angles dans cette version : rien à reprendre, sans erreur', () => {
    expect(backup.modules.cv_angles).toBeUndefined();
    expect(report.counts.cvs).toBe(1);
  });
});

describe('cas particuliers', () => {
  it('modèle de CV inconnu : remplacé par « Classique », et signalé', () => {
    const b = recent();
    b.modules.cv_documents![0].template_id = 'ancien-modele';
    const { backup, report } = convertCvmakerBackup(b);
    expect(backup.modules.cv_documents![0].template_id).toBe(FALLBACK_TEMPLATE_ID);
    expect(report.converted.join(' ')).toContain('Le CV « CV ADV » utilisait un modèle absent de Phénix CV : il passe au modèle « Classique ».');
  });

  it('photo qui n\'est pas une image (chemin de fichier, autre format) : écartée, avec un conseil', () => {
    for (const photo of ['C:\\Users\\camille\\photo.jpg', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zz4=']) {
      const b = recent();
      b.modules.profiles![0].photo_path = photo;
      const { backup, report } = convertCvmakerBackup(b);
      expect(backup.modules.profiles![0].photo_path).toBeNull();
      expect(report.warnings).toContain('Votre photo n\'a pas pu être reprise. Ajoutez-la à nouveau dans « Mon profil ».');
    }
  });

  it('lien personnel déjà présent (fichier Phénix CV) : jamais remplacé', () => {
    const b = recent();
    b.modules.profiles![0].other_url = 'https://autre.example';
    const { backup, report } = convertCvmakerBackup(b);
    expect(backup.modules.profiles![0].other_url).toBe('https://autre.example');
    expect(report.converted.join(' ')).not.toContain('lien');
  });

  it('dates : formats reconnus, jamais de jour ou de mois deviné', () => {
    expect(normalizeEntryDate('2018')).toEqual({ value: '2018', changed: false, recognized: true });
    expect(normalizeEntryDate('2018-03')).toEqual({ value: '2018-03', changed: false, recognized: true });
    expect(normalizeEntryDate('2018-03-07')).toEqual({ value: '2018-03-07', changed: false, recognized: true });
    expect(normalizeEntryDate('2018-03-07T00:00:00.000Z')).toEqual({ value: '2018-03-07', changed: true, recognized: true });
    expect(normalizeEntryDate('9/2015')).toEqual({ value: '2015-09', changed: true, recognized: true });
    expect(normalizeEntryDate('2015/09')).toEqual({ value: '2015-09', changed: true, recognized: true });
    expect(normalizeEntryDate('12/03/2015')).toEqual({ value: '2015-03-12', changed: true, recognized: true });
    expect(normalizeEntryDate(null)).toEqual({ value: null, changed: false, recognized: true });
    expect(normalizeEntryDate('  ')).toEqual({ value: null, changed: false, recognized: true });
    // Impossibles ou ambiguës : gardées telles quelles, signalées.
    for (const bad of ['13/2015', '31/02/2015', '2015-13', 'printemps 2015']) expect(normalizeEntryDate(bad).recognized).toBe(false);
  });

  it('date non reconnue : gardée et signalée pour vérification', () => {
    const b = recent();
    b.modules.master_entries![0].start_date = 'printemps 2018';
    const { backup, report } = convertCvmakerBackup(b);
    expect(backup.modules.master_entries![0].start_date).toBe('printemps 2018');
    expect(report.warnings).toContain('Date non reconnue « printemps 2018 » pour « Assistante commerciale » : vérifiez-la dans « Mon profil ».');
  });
});

describe('fichier abîmé (téléchargement interrompu)', () => {
  it('ne se lit pas comme une sauvegarde', () => {
    expect(() => JSON.parse(raw('camille-martin-abime'))).toThrow();
  });
});
