/**
 * Prompt « CV standard » (sans annonce ni entreprise visée) : l'IA joue le rôle d'un coach de carrière.
 * Elle part de ce que le candidat recherche (réponses au questionnaire, lib/cv-intent.ts) et reformule
 * les faits du profil de façon plus ou moins affirmée, selon le réglage choisi, sans rien inventer.
 *
 * Mêmes données, mêmes règles anti-invention et même schéma de sortie que le prompt « CV ciblé »
 * (lib/cv-prompt.ts) : la réponse passe par le même garde-fou et la même application. Fonctions pures.
 */
import type { MasterEntry, Profile } from '@/types/profile';
import {
  buildAnalysisStep, buildClarify, buildContext, buildExtraContext, buildHeaderMentions, buildMasterProfile,
  buildOutputSchema, buildRules, type CvPromptInput, type CvPromptOptions,
} from './cv-prompt';
import { DEFAULT_BULLET_FOCUS, DEFAULT_VERB_TENSE } from './cv-focus-rules';
import { resolveTarget } from './cv-targets';
import { parseHeaderExtras } from './header-extras';
import {
  ASSERTIVENESS_LABELS, HIGHLIGHT_LABELS, INTENT_QUESTIONS, LEVEL_LABELS, type Assertiveness, type CvIntent,
} from './cv-intent';

export interface GenericCvPromptInput {
  profile: Profile;
  entries: MasterEntry[];
  intent: CvIntent;
  /** L'IA peut poser quelques questions avant de répondre (même protocole que le CV ciblé). */
  clarify?: boolean;
  /** Pages et langue viennent des réponses ; `target` et `cibleAxes` sont fixés ici. */
  options?: Omit<CvPromptOptions, 'pageBudget' | 'cvLanguage' | 'target' | 'cibleAxes' | 'angle' | 'angleChoices'>;
}

/** Sans annonce : tout le vocabulaire du prompt parle de « cible » (dictionnaire de lib/cv-wording.ts). */
const GENERIC_TARGET = resolveTarget({ intent: 'spontanee' });

export function buildGenericRole(): string {
  return `# Rôle
Tu es un coach de carrière, tous secteurs et tous métiers confondus, doublé d'un recruteur expérimenté. Tu aides le candidat à se présenter de façon plus convaincante, quelle que soit la structure qui lira son CV, sans jamais rien inventer.`;
}

export function buildGenericObjective(): string {
  return `## Objectif
Produire UN objet JSON (schéma en fin de prompt) pour un CV généraliste : aucune annonce et aucune entreprise ne sont visées. Le CV part de ce que le candidat recherche (section « Cible » ci-dessous) et met en valeur ce qu'il fait de mieux. Tu sélectionnes, tu ordonnes et tu reformules les éléments du profil maître ; tu ne crées aucune donnée. Ce qui manque est signalé, jamais comblé.`;
}

/** Consignes de ton par niveau d'affirmation. Les faits sont les mêmes à tous les niveaux. */
export const ASSERTIVENESS_RULES: Readonly<Record<Assertiveness, string>> = {
  sobre: "Ton sobre : reformule fidèlement, avec des verbes précis mais mesurés, au plus près des mots de la source. L'accroche décrit le parcours et le poste recherché sans revendiquer d'expertise. Aucune mise en avant appuyée.",
  equilibre: "Ton équilibré : verbes d'action concrets, réalisations et responsabilités en tête de puce, accroche qui affirme clairement le poste recherché et les points forts. Pas de superlatif.",
  affirme: "Ton affirmé : verbes d'action forts quand la source le permet (piloter, conduire, développer, garantir), résultats et périmètre en tête de puce, accroche qui assume l'expertise et le poste recherché. Affirmé ne veut pas dire exagéré : toujours aucun superlatif ni adjectif d'auto-promotion.",
};

/** Règle commune aux trois niveaux : le ton change, jamais les faits. */
export const ASSERTIVENESS_FACTS_RULE =
  "Quel que soit le niveau, le ton change mais jamais les faits : aucune responsabilité, aucun périmètre, aucun niveau ni aucun résultat au-delà de la source. Une participation reste une participation (« participer à » ne devient jamais « piloter »), une aide reste une aide.";

const answer = (question: string, value: string): string => {
  const t = value.trim().replace(/\s*\n\s*/g, ' ');
  return t ? `- ${question} ${t}` : '';
};

/**
 * Bloc « Cible » : les réponses du candidat, présentées comme une source au même titre que le profil.
 * Les questions sans réponse sont omises.
 */
export function buildGenericTarget(intent: CvIntent): string {
  const lines = [
    answer(INTENT_QUESTIONS.role, [intent.role, intent.sector.trim() ? `(secteur : ${intent.sector.trim()})` : ''].filter(s => s.trim()).join(' ')),
    answer(INTENT_QUESTIONS.environment, intent.environment),
    answer(INTENT_QUESTIONS.ease, intent.ease),
    answer(INTENT_QUESTIONS.achievements, intent.achievements),
    answer(INTENT_QUESTIONS.highlights, intent.highlights.map(h => HIGHLIGHT_LABELS[h]).join(', ')),
    answer(INTENT_QUESTIONS.level, LEVEL_LABELS[intent.level]),
    answer(INTENT_QUESTIONS.avoid, intent.avoid),
  ].filter(Boolean);
  return `## Cible : ce que le candidat recherche (ses réponses, source au même titre que le profil maître)
${lines.join('\n')}
- Langue du CV : ${intent.language} (utilise ce code pour analyse.langue_annonce).

### Comment t'en servir
- Les indispensables de l'étape 0 sont tirés de ces réponses : le poste recherché, ce qu'il fait avec aisance, ce qu'il veut que l'on retienne.
- Mets en tête, dans les puces comme dans les compétences, ce que le candidat dit faire avec aisance, quand le profil le montre.
- Une réalisation citée dans les réponses peut être reprise dans la puce de l'expérience concernée, avec ses mots et ses chiffres exacts ; si tu ne sais pas à quelle expérience elle se rattache, pose la question dans "warnings" au lieu de deviner.
- Ce que le candidat ne veut plus faire passe au second plan (puces plus courtes, ou \`visible: false\` si l'expérience n'apporte rien d'autre), sans jamais cacher une période d'activité réelle ni mentir sur le parcours.
- L'accroche reste ouverte : elle décrit le poste recherché et ce que le candidat apporte, sans viser une entreprise.`;
}

export function buildAssertiveness(level: Assertiveness): string {
  return `## Niveau d'affirmation : ${ASSERTIVENESS_LABELS[level]}
- ${ASSERTIVENESS_RULES[level]}
- ${ASSERTIVENESS_FACTS_RULE}`;
}

/** Règle ajoutée à l'anti-invention : les réponses du candidat sont une source, à reprendre sans amplifier. */
export const ANSWERS_AS_SOURCE_RULE =
  "- Les réponses du candidat (section « Cible ») comptent comme source au même titre que le profil maître : un fait, un chiffre ou un outil qu'il y énonce peut être repris tel quel, jamais amplifié. Elles ne servent pas à remplir \"suggestedEntries\".";

/** Assemble le prompt du CV standard. */
export function buildGenericCvPrompt(input: GenericCvPromptInput): string {
  const { profile, entries, intent } = input;
  const options: CvPromptOptions = {
    ...input.options,
    pageBudget: intent.pages,
    cvLanguage: intent.language,
    target: GENERIC_TARGET,
    cibleAxes: [],
  };
  const base: CvPromptInput = { profile, entries, jobOfferText: '', options };
  const personal = Boolean(options.personalRules?.trim());
  // Règle des réponses insérée juste après le titre de l'anti-invention (même bloc, même autorité).
  const rules = buildRules(base).replace(
    '### Anti-invention (règle absolue)\n',
    `### Anti-invention (règle absolue)\n${ANSWERS_AS_SOURCE_RULE}\n`,
  );
  return [
    buildGenericRole(),
    buildGenericObjective(),
    buildContext(base),
    buildMasterProfile(entries, profile),
    buildHeaderMentions(profile),
    buildExtraContext(undefined),
    buildGenericTarget(intent),
    buildAssertiveness(intent.assertiveness),
    buildAnalysisStep({ alertesCap: personal, mode: 'cible', cibleAxes: [] }),
    rules,
    buildClarify(input.clarify),
    buildOutputSchema({
      alertesCap: personal,
      header: Boolean(profile.drivingLicense?.trim()) || parseHeaderExtras(profile.headerExtras).length > 0,
      bulletFocus: options.bulletFocus ?? DEFAULT_BULLET_FOCUS,
      verbTense: options.verbTense ?? DEFAULT_VERB_TENSE,
      mode: 'cible',
      cibleAxes: [],
    }),
  ].filter(Boolean).join('\n\n');
}
