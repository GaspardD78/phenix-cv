import { describe, expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deleteBrief, loadBrief, saveBrief, type BriefDb } from './target-brief-repo';
import { validateTargetBrief, addBriefItem } from './target-brief';

const MIGRATIONS = join(import.meta.dir, '..', '..', 'src-tauri', 'migrations');
const NOW = new Date('2026-11-17T10:00:00Z');
const fixture = JSON.parse(readFileSync(join(import.meta.dir, '..', '..', 'tests', 'fixtures', 'brief', 'fiche-adv.json'), 'utf8')) as unknown;

function makeDb() {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  db.query("INSERT INTO profiles (id, first_name, last_name) VALUES ('phx', 'Camille', 'Martin')").run();
  const adapter: BriefDb = {
    select: async <T,>(q: string, v: unknown[] = []) => db.query(q).all(...(v as never[])) as T,
    execute: async (q: string, v: unknown[] = []) => { db.query(q).run(...(v as never[])); },
  };
  return { db, adapter };
}

describe('cache des fiches (vraie base SQLite, clés étrangères activées)', () => {
  const { brief } = validateTargetBrief(fixture, { now: NOW });
  const query = { role: 'Assistante ADV', sector: 'Industrie' };

  it('enregistre, relit, et retrouve la fiche malgré accents et majuscules', async () => {
    const { adapter } = makeDb();
    expect(await loadBrief('phx', query, adapter)).toBeNull();
    await saveBrief('phx', query, brief, adapter);
    const back = await loadBrief('phx', { role: ' assistante  ADV ', sector: 'industrié' }, adapter);
    expect(back).toEqual(brief);
    expect(await loadBrief('phx', { role: 'Assistante ADV', sector: 'Industrie', company: 'Laiterie du Val' }, adapter)).toBeNull();
  });

  it('remplace la fiche d\'un même métier (corrections de la personne comprises)', async () => {
    const { db, adapter } = makeDb();
    await saveBrief('phx', query, brief, adapter);
    const corrected = addBriefItem(brief, 'vocabulary', 'avoir client', NOW);
    await saveBrief('phx', query, corrected, adapter);
    expect(db.query('SELECT COUNT(*) AS n FROM target_briefs').get()).toEqual({ n: 1 });
    expect((await loadBrief('phx', query, adapter))?.vocabulary.map(v => v.text)).toContain('avoir client');
  });

  it('« Actualiser » : la fiche est oubliée', async () => {
    const { adapter } = makeDb();
    await saveBrief('phx', query, brief, adapter);
    await deleteBrief('phx', query, adapter);
    expect(await loadBrief('phx', query, adapter)).toBeNull();
  });

  it('une ligne abîmée ou modifiée à la main ne donne rien (ou rien d\'infondé)', async () => {
    const { db, adapter } = makeDb();
    await saveBrief('phx', query, brief, adapter);
    db.query("UPDATE target_briefs SET brief = '{pas du json'").run();
    expect(await loadBrief('phx', query, adapter)).toBeNull();
    const tampered = JSON.parse(JSON.stringify(brief)) as typeof brief;
    tampered.skills.push({ text: 'Expert SAP', sources: ['s404'], confidence: 'officiel', level: 'indispensable', kind: 'outil' });
    db.query('UPDATE target_briefs SET brief = ?1').run(JSON.stringify(tampered));
    expect((await loadBrief('phx', query, adapter))?.skills.map(s => s.text)).not.toContain('Expert SAP');
  });

  it('les fiches disparaissent avec le profil (clé étrangère)', async () => {
    const { db, adapter } = makeDb();
    await saveBrief('phx', query, brief, adapter);
    db.query("DELETE FROM profiles WHERE id = 'phx'").run();
    expect(db.query('SELECT COUNT(*) AS n FROM target_briefs').get()).toEqual({ n: 0 });
  });
});
