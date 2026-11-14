import { describe, expect, it } from 'bun:test';
import { findJsonObjects, parseImportResponse } from './extract-json';

const DATA = {
  profile: { firstName: 'Camille', lastName: 'Martin', title: 'Assistante commerciale' },
  entries: [
    { entryType: 'experience', title: 'Assistante commerciale', subtitle: 'Maison Lambert', startDate: '2021-03', isCurrent: true, description: '- Gérer les commandes {urgentes}\n- Rédiger les devis' },
    { entryType: 'skill', title: 'Excel' },
  ],
};
const JSON_TEXT = JSON.stringify(DATA, null, 2);

function ok(text: string) {
  const r = parseImportResponse(text);
  if (!r.ok) throw new Error(`échec inattendu : ${r.message}`);
  return r;
}

describe('parseImportResponse : réponses tolérées', () => {
  it('JSON nu', () => {
    const r = ok(JSON_TEXT);
    expect(r.payload.profile?.firstName).toBe('Camille');
    expect(r.payload.entries).toHaveLength(2);
    expect(r.repaired).toBe(false);
  });

  it('entouré de texte et de balises Markdown', () => {
    const r = ok(`Voici le résultat de l'analyse :\n\n\`\`\`json\n${JSON_TEXT}\n\`\`\`\n\nN'hésitez pas si vous avez besoin d'autre chose !`);
    expect(r.payload.entries).toHaveLength(2);
  });

  it('balises sans langue, ou texte avant et après sans balises', () => {
    expect(ok(`\`\`\`\n${JSON_TEXT}\n\`\`\``).payload.profile?.lastName).toBe('Martin');
    expect(ok(`Bien sûr ! ${JSON_TEXT} J'espère que cela vous aide.`).payload.profile?.lastName).toBe('Martin');
  });

  it('accolades dans une description : non confondues avec la structure', () => {
    const r = ok(`Voilà : ${JSON_TEXT}`);
    expect(r.payload.entries?.[0].description).toContain('{urgentes}');
  });

  it('guillemets typographiques, BOM, espaces insécables', () => {
    const smart = JSON_TEXT.replace(/"/g, '\u201C').replace(/\u201C(\w+)\u201C:/g, '\u201C$1\u201D:');
    const r = ok(`\uFEFF${JSON_TEXT.replace(/ /g, '\u00A0')}`);
    expect(r.payload.entries).toHaveLength(2);
    expect(smart.length).toBeGreaterThan(0);
    const typo = `{ \u201Cprofile\u201D: { \u201CfirstName\u201D: \u201CCamille\u201D }, \u201Centries\u201D: [] }`;
    expect(ok(typo).payload.profile?.firstName).toBe('Camille');
  });

  it('virgules finales et commentaires', () => {
    const r = ok(`{\n  // profil\n  "profile": { "firstName": "Camille", },\n  "entries": [ { "entryType": "skill", "title": "Excel", }, ],\n}`);
    expect(r.repaired).toBe(true);
    expect(r.payload.entries?.[0].title).toBe('Excel');
  });

  it('plusieurs blocs : prend celui qui est un profil', () => {
    const r = ok(`Exemple de format : \`\`\`json\n{"nom": "exemple"}\n\`\`\`\nVotre résultat : \`\`\`json\n${JSON_TEXT}\n\`\`\``);
    expect(r.payload.profile?.firstName).toBe('Camille');
  });
});

describe('parseImportResponse : échecs avec message humain', () => {
  it('vide', () => {
    const r = parseImportResponse('   ');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('vide');
  });

  it('aucun JSON', () => {
    const r = parseImportResponse("Désolé, je ne peux pas analyser ce CV.");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("pas trouvé de données");
      expect(r.advice).toContain('Renvoie uniquement le JSON');
    }
  });

  it('réponse coupée', () => {
    const r = parseImportResponse(JSON_TEXT.slice(0, JSON_TEXT.length - 40));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain('coupée');
      expect(r.advice).toContain('Continue');
    }
  });

  it('JSON valide mais pas un profil : message sans jargon', () => {
    const r = parseImportResponse('{"foo": 1}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('ni profil ni éléments');
  });

  it('type d\'élément inconnu : numéro lisible', () => {
    const r = parseImportResponse('{"entries": [{"entryType": "poste", "title": "X"}]}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("n° 1");
      expect(r.message).not.toContain('entries[');
    }
  });
});

describe('findJsonObjects', () => {
  it('ignore les accolades dans les chaînes et trouve plusieurs objets', () => {
    expect(findJsonObjects('a {"x": "}"} b {"y": 1}')).toEqual(['{"x": "}"}', '{"y": 1}']);
  });
});
