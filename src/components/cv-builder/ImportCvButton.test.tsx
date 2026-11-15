import { describe, expect, it } from 'bun:test';
import type { ReactElement } from 'react';
import { ImportCvButton } from './ImportCvButton';

describe('bouton « Importer » de Mes CV', () => {
  it('un clic ouvre l\'écran d\'import', () => {
    const visited: string[] = [];
    const element = ImportCvButton({ navigate: (to) => visited.push(to) }) as ReactElement<{ onClick: () => void }>;

    expect(element.type).toBe('button');
    element.props.onClick();
    expect(visited).toEqual(['/import']);
  });
});
