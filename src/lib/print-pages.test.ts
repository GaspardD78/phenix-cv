import { describe, expect, it } from 'bun:test';
import { PAGE_MARGIN_BOTTOM_MM, PAGE_MARGIN_TOP_MM, multipagePrintCss } from './print-pages';

describe('multipagePrintCss', () => {
  it('numérote les pages « n / total » dans la marge du bas, avec la police du CV', () => {
    const css = multipagePrintCss({ fontFamily: 'Lato, Arial, sans-serif' });
    expect(css).toContain('@bottom-center { content: counter(page) " / " counter(pages); font-family: Lato, Arial, sans-serif;');
    expect(css).toContain(`margin: ${PAGE_MARGIN_TOP_MM}mm 0 ${PAGE_MARGIN_BOTTOM_MM}mm 0;`);
    expect(css).toContain('@page :first { margin-top: 0; }');
  });

  it('prolonge la bande latérale dans les marges haute et basse, du bon côté', () => {
    const left = multipagePrintCss({ fontFamily: 'Arial', left: { width: '34%', color: 'rgb(30, 41, 59)' } });
    expect(left).toContain('@top-left { content: ""; width: 34%; background: rgb(30, 41, 59); }');
    expect(left).toContain('@bottom-left { content: ""; width: 34%; background: rgb(30, 41, 59); }');
    expect(left).not.toContain('@top-right');
    const right = multipagePrintCss({ fontFamily: 'Arial', right: { width: '4px', color: 'rgb(67, 56, 202)' } });
    expect(right).toContain('@bottom-right { content: ""; width: 4px;');
    expect(right).not.toContain('@top-left');
  });

  it('neutralise une police qui casserait la feuille de style', () => {
    expect(multipagePrintCss({ fontFamily: 'Arial; } body { display: none' })).not.toContain('display: none;');
  });
});
