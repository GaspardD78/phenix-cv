/**
 * Lecture tolérante de la réponse d'une IA collée par l'utilisateur.
 *
 * L'IA entoure souvent le JSON de phrases, de balises Markdown (```json), de guillemets typographiques ou
 * de virgules en trop. On cherche tous les objets JSON possibles dans le texte, on tente de les réparer
 * sans rien inventer, puis on valide le premier qui ressemble à un profil. En cas d'échec, le message dit
 * quoi faire, sans jargon.
 */
import type { ImportPayload } from './types';
import { parseImportJson } from './json-validator';

export type ImportResponseResult =
  | { ok: true; payload: ImportPayload; repaired: boolean }
  | { ok: false; message: string; advice: string };

const ASK_AGAIN = 'Retournez dans la conversation avec l\'IA et écrivez : « Renvoie uniquement le JSON complet, sans aucun texte autour. » Puis copiez sa nouvelle réponse en entier.';

/** Remplace les guillemets typographiques par des guillemets droits et retire BOM et espaces insécables. */
function normalizeChars(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u00A0\u202F\u2007]/g, ' ')
    .replace(/[\u200B\u200C\u200D\u2060]/g, '');
}

/** Retire commentaires de ligne, virgules finales et séparateurs de milliers d'un JSON presque valide. */
function repairJson(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\') { out += text[++i] ?? ''; continue; }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; out += c; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  // Virgules finales avant } ou ].
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/** Tous les objets `{ ... }` équilibrés du texte, en ignorant les accolades dans les chaînes. */
export function findJsonObjects(text: string): string[] {
  const found: string[] = [];
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === '\\') i++;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          found.push(text.slice(start, i + 1));
          start = i; // objet englobant trouvé : on passe à la suite
          break;
        }
      }
    }
  }
  return found;
}

/** Vrai si le premier `{` du texte n'est jamais refermé : la réponse a été coupée (copie incomplète, IA arrêtée). */
export function looksTruncated(text: string): boolean {
  const start = text.indexOf('{');
  if (start < 0) return false;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return false;
  }
  return true;
}

/** Contenu des blocs de code Markdown (```json … ```), en premier : c'est là que l'IA met sa réponse. */
function fencedBlocks(text: string): string[] {
  return [...text.matchAll(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/g)].map(m => m[1]);
}

/** Traduit les messages techniques du validateur en phrases lisibles. */
export function humanizeValidationError(message: string): string {
  const entry = message.match(/^entries\[(\d+)\]\.entryType invalide : "(.*)"/);
  if (entry) return `L'élément n° ${Number(entry[1]) + 1} a un type inconnu (« ${entry[2]} »).`;
  const title = message.match(/^entries\[(\d+)\]\.title est obligatoire/);
  if (title) return `L'élément n° ${Number(title[1]) + 1} n'a pas d'intitulé.`;
  const obj = message.match(/^entries\[(\d+)\] doit être un objet/);
  if (obj) return `L'élément n° ${Number(obj[1]) + 1} est mal formé.`;
  const field = message.match(/^profile\.(\w+) doit être une chaîne/);
  if (field) return `Le champ « ${field[1]} » de votre profil n'est pas un texte.`;
  if (message.startsWith('Le JSON ne contient ni')) return "La réponse ne contient ni profil ni éléments (expériences, formations…).";
  if (message.includes('"entries" doit être un tableau')) return 'La liste des éléments est mal formée.';
  return message;
}

export function parseImportResponse(raw: string): ImportResponseResult {
  const text = normalizeChars(raw ?? '').trim();
  if (!text) {
    return { ok: false, message: "Le champ est vide.", advice: "Copiez la réponse complète de l'IA, puis collez-la ici." };
  }
  if (!text.includes('{')) {
    return {
      ok: false,
      message: "Nous n'avons pas trouvé de données dans ce texte.",
      advice: `La réponse de l'IA doit commencer par « { » et finir par « } ». ${ASK_AGAIN}`,
    };
  }

  // Candidats : blocs de code d'abord, puis le texte entier, puis chaque objet équilibré (le plus grand d'abord).
  const sources = [...fencedBlocks(text), text];
  const candidates: string[] = [];
  for (const source of sources) {
    const objects = findJsonObjects(source).sort((a, b) => b.length - a.length);
    for (const o of objects) if (!candidates.includes(o)) candidates.push(o);
  }

  let validationError: string | null = null;
  let parsedSomething = false;
  for (const candidate of candidates) {
    for (const [variant, repaired] of [[candidate, false], [repairJson(candidate), true]] as const) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(variant);
      } catch {
        continue;
      }
      parsedSomething = true;
      try {
        return { ok: true, payload: parseImportJson(JSON.stringify(parsed)), repaired };
      } catch (e) {
        validationError ??= humanizeValidationError(e instanceof Error ? e.message : String(e));
      }
      break; // JSON lu mais refusé : inutile d'essayer la variante réparée
    }
  }

  if (parsedSomething && !looksTruncated(text)) {
    return {
      ok: false,
      message: validationError ?? "Les données ne sont pas au format attendu.",
      advice: `Il manque peut-être des informations dans la réponse de l'IA. ${ASK_AGAIN}`,
    };
  }
  return {
    ok: false,
    message: 'La réponse semble coupée ou modifiée : nous ne parvenons pas à la lire.',
    advice: `Vérifiez que vous avez copié la réponse jusqu'à la toute fin (jusqu'au dernier « } »). Si l'IA s'est arrêtée en cours de route, écrivez-lui « Continue ». ${ASK_AGAIN}`,
  };
}
