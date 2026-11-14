import { describe, expect, it } from 'bun:test';
import { classifyDroppedPaths, extensionOf, fileName } from './file-kind';

describe('classifyDroppedPaths', () => {
  it('PDF, Word, export LinkedIn', () => {
    expect(classifyDroppedPaths(['C:\\Users\\Camille\\Documents\\CV.PDF'])).toEqual({ ok: true, path: 'C:\\Users\\Camille\\Documents\\CV.PDF', format: 'pdf', name: 'CV.PDF' });
    expect(classifyDroppedPaths(['/home/c/mon cv.docx'])).toMatchObject({ ok: true, format: 'docx', name: 'mon cv.docx' });
    expect(classifyDroppedPaths(['/tmp/Basic_LinkedInDataExport.zip'])).toMatchObject({ ok: true, format: 'linkedin' });
  });
  it('plusieurs fichiers : le premier qui convient', () => {
    expect(classifyDroppedPaths(['/a/photo.png', '/a/cv.pdf'])).toMatchObject({ ok: true, name: 'cv.pdf' });
  });
  it('messages clairs pour les formats non pris en charge', () => {
    const doc = classifyDroppedPaths(['/a/cv.doc']);
    expect(doc.ok).toBe(false);
    if (!doc.ok) expect(doc.message).toContain('.docx');
    const img = classifyDroppedPaths(['/a/scan.jpg']);
    if (!img.ok) expect(img.message).toContain('image');
    const other = classifyDroppedPaths(['/a/notes.txt']);
    if (!other.ok) expect(other.message).toContain('PDF ou en Word');
    expect(classifyDroppedPaths([]).ok).toBe(false);
  });
  it('extension et nom', () => {
    expect(extensionOf('/a/b/.gitignore')).toBe('');
    expect(extensionOf('archive.tar.GZ')).toBe('gz');
    expect(fileName('C:\\x\\y.pdf')).toBe('y.pdf');
  });
});
