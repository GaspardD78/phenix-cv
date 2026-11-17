import { describe, expect, it } from 'bun:test';
import { UNKNOWN_APP_MODE, describeAppMode, normalizeAppMode } from './app-mode';

describe('version portable : textes et lecture', () => {
  it('lecture prudente de la réponse du backend', () => {
    expect(normalizeAppMode({ portable: true, dataDir: 'E:\\Phenix\\data', warning: null })).toEqual({ portable: true, dataDir: 'E:\\Phenix\\data', warning: null });
    expect(normalizeAppMode({ portable: 'oui', dataDir: '  ', warning: 3 })).toEqual({ portable: false, dataDir: null, warning: null });
    expect(normalizeAppMode(null)).toEqual(UNKNOWN_APP_MODE);
    expect(normalizeAppMode('x')).toEqual(UNKNOWN_APP_MODE);
  });

  it('version portable : où sont les données, comment les emporter', () => {
    const t = describeAppMode({ portable: true, dataDir: 'E:\\Phenix\\data', warning: null });
    expect(t?.tone).toBe('portable');
    expect(t?.lines.join(' ')).toContain('dossier « data », à côté de l\'application');
    expect(t?.lines.join(' ')).toContain('copiez le dossier de l\'application en entier');
    expect(t?.lines.join(' ')).toContain('Fermez Phénix CV avant de retirer la clé');
  });

  it('dossier data inutilisable : avertissement et conseil', () => {
    const t = describeAppMode({ portable: false, dataDir: 'C:\\Users\\x\\AppData', warning: 'Le dossier « E:\\data » n\'est pas accessible en écriture.' });
    expect(t?.tone).toBe('warning');
    expect(t?.lines[0]).toContain('n\'est pas accessible en écriture');
    expect(t?.lines[1]).toContain('dossier où vous pouvez écrire');
  });

  it('application installée : une phrase ; inconnu : rien', () => {
    expect(describeAppMode({ portable: false, dataDir: 'C:\\x', warning: null })?.tone).toBe('installed');
    expect(describeAppMode(UNKNOWN_APP_MODE)).toBeNull();
  });
});
