import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLOCKING_STEP_CLASS, COPIED_STEP_CLASS, PRIMARY_STEP_CLASS, SECONDARY_STEP_CLASS, currentAiStep, stepButtonClass,
} from './ai-step-buttons';

const isPrimary = (c: string) => c === PRIMARY_STEP_CLASS || c === BLOCKING_STEP_CLASS;

describe('parcours IA : un seul bouton orange, celui de l\'étape en cours', () => {
  it('au départ, « 1. Copier » est le bouton principal et « 3. Appliquer » est secondaire', () => {
    const current = currentAiStep('');
    expect(current).toBe('copy');
    expect(stepButtonClass('copy', current)).toBe(PRIMARY_STEP_CLASS);
    expect(stepButtonClass('apply', current)).toBe(SECONDARY_STEP_CLASS);
  });

  it('une réponse collée fait passer à « 3. Appliquer » ; « 1. Copier » redevient secondaire', () => {
    const current = currentAiStep('  {"title": "Assistante ADV"}  ');
    expect(current).toBe('apply');
    expect(stepButtonClass('copy', current)).toBe(SECONDARY_STEP_CLASS);
    expect(stepButtonClass('apply', current)).toBe(PRIMARY_STEP_CLASS);
    // Des espaces seuls ne comptent pas comme une réponse.
    expect(currentAiStep(' \n ')).toBe('copy');
  });

  it('points bloquants : « Appliquer quand même » en rouge, toujours seul bouton principal', () => {
    expect(stepButtonClass('apply', 'apply', { blocking: true })).toBe(BLOCKING_STEP_CLASS);
    expect(stepButtonClass('apply', 'copy', { blocking: true })).toBe(SECONDARY_STEP_CLASS);
  });

  it('jamais deux boutons principaux à la fois, quel que soit l\'état', () => {
    for (const pasted of ['', '{}']) for (const copied of [false, true]) for (const blocking of [false, true]) {
      const current = currentAiStep(pasted);
      const primaries = [
        stepButtonClass('copy', current, { copied }),
        stepButtonClass('apply', current, { blocking }),
      ].filter(isPrimary);
      expect(primaries.length).toBeLessThanOrEqual(1);
    }
    // Juste après la copie : confirmation verte, pas d'orange.
    expect(stepButtonClass('copy', 'copy', { copied: true })).toBe(COPIED_STEP_CLASS);
  });

  it('les deux boutons de l\'onglet offre suivent cette règle', () => {
    const src = readFileSync(join(import.meta.dir, '..', 'components', 'cv-builder', 'AIPromptPanel.tsx'), 'utf8');
    expect(src).toContain("stepButtonClass('copy', currentAiStep(jsonInput)");
    expect(src).toContain("stepButtonClass('apply', currentAiStep(jsonInput)");
    expect(src).not.toContain("hasBlockingIssues ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'");
  });
});
