/**
 * Évaluation du CV « à vrai impact » : prépare les textes à copier dans votre IA, relit les réponses que
 * vous collez dans des fichiers, contrôle les CV avec le garde-fou de l'application, puis fabrique la
 * grille de notation à l'aveugle. Aucun appel à une IA : vous restez celui qui juge.
 *
 *   bun scripts/impact-eval.ts            # écrit / met à jour eval-out/<profil>/…
 *   bun scripts/impact-eval.ts --seed 7   # autre tirage pour X et Y
 *
 * Dossier de sortie : eval-out/ (ignoré par git).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blindAssignments, gridMarkdown, loadCase, stageFiles, type EvalCase, type Replies } from '../src/lib/impact-eval';

const root = join(import.meta.dir, '..');
const casesDir = join(root, 'tests', 'fixtures', 'impact');
const out = join(root, 'eval-out');
const seedArg = process.argv.indexOf('--seed');
const seed = seedArg > -1 ? Number(process.argv[seedArg + 1]) || 1 : 1;

const read = (path: string): string | undefined => (existsSync(path) ? readFileSync(path, 'utf8') : undefined);

const cases = readdirSync(casesDir).filter(f => f.endsWith('.json')).sort()
  .map(f => loadCase(JSON.parse(readFileSync(join(casesDir, f), 'utf8')) as EvalCase));

mkdirSync(out, { recursive: true });
for (const c of cases) {
  const dir = join(out, c.label);
  mkdirSync(dir, { recursive: true });
  const replies: Replies = {
    brief: read(join(dir, 'brief.json')), analyse: read(join(dir, 'analyse.json')),
    cvSans: read(join(dir, 'cv-sans.json')), cvAvec: read(join(dir, 'cv-avec.json')),
  };
  const { files, next } = stageFiles(c, replies);
  for (const f of files) writeFileSync(join(dir, f.name), f.content);
  console.log(`${c.label.padEnd(16)} ${next}`);
}

const assignments = blindAssignments(cases.map(c => c.label), seed);
writeFileSync(join(out, 'grille.md'), gridMarkdown(cases));
writeFileSync(join(out, 'cle.json'), JSON.stringify({ seed, assignments }, null, 2));
console.log(`\nGrille : eval-out/grille.md. Clé (X et Y) : eval-out/cle.json, à n'ouvrir qu'après avoir tout noté.`);
