import { describe, expect, it } from 'bun:test';
import { isPhotoShown, readShowPhoto, withShowPhoto } from './cv-photo';

const WITH_PHOTO = { photoPath: 'data:image/png;base64,AAAA' };
const NO_PHOTO = { photoPath: null };

describe('interrupteur « Afficher la photo »', () => {
  it('un CV sans réglage affiche la photo (comportement d\'avant)', () => {
    expect(readShowPhoto({})).toBe(true);
    expect(readShowPhoto(null)).toBe(true);
    expect(readShowPhoto(undefined)).toBe(true);
    expect(isPhotoShown(WITH_PHOTO, {})).toBe(true);
  });

  it('seule la valeur false masque la photo', () => {
    expect(readShowPhoto({ showPhoto: false })).toBe(false);
    expect(readShowPhoto({ showPhoto: true })).toBe(true);
    // Valeur inattendue : on garde le comportement par défaut.
    expect(readShowPhoto({ showPhoto: 'non' })).toBe(true);
    expect(isPhotoShown(WITH_PHOTO, { showPhoto: false })).toBe(false);
  });

  it('sans photo dans le profil, rien ne sort, quel que soit le réglage', () => {
    expect(isPhotoShown(NO_PHOTO, {})).toBe(false);
    expect(isPhotoShown(NO_PHOTO, { showPhoto: true })).toBe(false);
    expect(isPhotoShown({ photoPath: '' }, {})).toBe(false);
    expect(isPhotoShown(null, {})).toBe(false);
  });

  it('withShowPhoto ne touche qu\'au réglage de la photo', () => {
    const before = { photoShape: 'rounded-lg', primaryColor: '#123456' };
    const after = withShowPhoto(before, false);
    expect(after).toEqual({ photoShape: 'rounded-lg', primaryColor: '#123456', showPhoto: false });
    expect(before).toEqual({ photoShape: 'rounded-lg', primaryColor: '#123456' });
    expect(withShowPhoto(undefined, true)).toEqual({ showPhoto: true });
  });
});
