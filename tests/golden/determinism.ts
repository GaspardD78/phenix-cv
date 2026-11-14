/**
 * Vérifie que le banc golden est déterministe : deux régénérations de suite des
 * références, la première depuis un dossier vide, donnent exactement les mêmes
 * fichiers, même quand l'environnement change entre les deux (fichier parasite
 * contenant des classes CSS). Code de sortie ≠ 0 au moindre écart.
 *
 *   bun run test:golden:determinisme
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const REFS = join(import.meta.dir, 'references');
const NOISE = join(ROOT, 'bruit-determinisme.html');

function hashTree(dir: string, base = dir, out: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) hashTree(p, base, out);
    else out[p.slice(base.length + 1)] = createHash('sha256').update(readFileSync(p)).digest('hex');
  }
  return out;
}

async function regenerate(): Promise<void> {
  const proc = Bun.spawn(['bun', join(import.meta.dir, 'run.ts'), '--update'], { stdout: 'ignore', stderr: 'inherit', env: process.env });
  if ((await proc.exited) !== 0) throw new Error('La régénération des références a échoué.');
}

// Première génération depuis zéro (références absentes), puis seconde : le CSS ne doit pas dépendre
// des fichiers de référence eux-mêmes (cause d'un écart constaté avant que Tailwind ait des sources explicites).
rmSync(REFS, { recursive: true, force: true });
await regenerate();
const first = hashTree(REFS);

// Perturbation : un fichier non versionné parlant de classes CSS ne doit rien changer.
writeFileSync(NOISE, '<div class="p-[13px] bg-[#123456] text-[17px] grid-cols-7 rotate-[7deg]"></div>');
try {
  await regenerate();
} finally {
  rmSync(NOISE, { force: true });
}
const second = hashTree(REFS);

const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
const diffs = [...keys].filter((k) => first[k] !== second[k]);
if (diffs.length) {
  console.error(`NON DÉTERMINISTE : ${diffs.length} fichier(s) diffèrent entre deux passes :\n  ${diffs.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}
console.log(`Déterministe : ${keys.size} fichiers de référence identiques entre deux régénérations, malgré un fichier parasite.`);
