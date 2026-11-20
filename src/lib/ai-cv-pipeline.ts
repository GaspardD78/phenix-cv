import { guardAiCv, type GuardContext, type GuardReport } from './ai-cv-guard';
import { parseAiCvResponse, type AiCvResponse } from './ai-cv-response';
import { repairAiIds } from './ai-id-repair';

export type AiCvAnalysis =
  | { ok: true; /** Réponse nettoyée (à appliquer). */ data: AiCvResponse; report: GuardReport }
  | { ok: false; error: string };

/**
 * Chaîne complète « JSON collé -> réponse exploitable » : parse tolérant puis
 * garde-fou. Point d'entrée unique des deux écrans (écrans de création de CV, panneau IA du
 * CV) pour que l'aperçu du rapport et l'application utilisent exactement les
 * mêmes données.
 */
export function analyzeAiCvJson(raw: string, ctx: GuardContext): AiCvAnalysis {
  let parsed: AiCvResponse;
  try {
    parsed = parseAiCvResponse(raw);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'JSON invalide' };
  }
  // Identifiants recopiés de travers (casse, guillemets, troncature) : rattachés aux entrées du profil.
  parsed = repairAiIds(parsed, ctx.entries.map(e => e.id)).data;
  const { data, report } = guardAiCv(parsed, ctx);
  return { ok: true, data, report };
}
