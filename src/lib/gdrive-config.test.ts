import { describe, expect, it } from 'bun:test';
import { resolveCredentials } from './gdrive-config';

describe('resolveCredentials', () => {
  it('sans aucun identifiant : null (synchronisation désactivée)', () => {
    expect(resolveCredentials({}, {})).toBeNull();
    expect(resolveCredentials({ clientId: '  ' }, { clientId: '' })).toBeNull();
    expect(resolveCredentials({ clientId: undefined }, { clientId: null })).toBeNull();
  });
  it('les identifiants du build passent avant la saisie manuelle', () => {
    expect(resolveCredentials({ clientId: 'build', clientSecret: 's1' }, { clientId: 'main', clientSecret: 's2' }))
      .toEqual({ clientId: 'build', clientSecret: 's1' });
  });
  it('saisie manuelle utilisée à défaut, secret facultatif', () => {
    expect(resolveCredentials({}, { clientId: ' main ' })).toEqual({ clientId: 'main', clientSecret: '' });
  });
});
