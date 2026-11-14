import { create } from 'zustand';
import type { ImportFormat } from '@/lib/import/types';

export interface PendingImportFile {
  path: string;
  format: ImportFormat;
  name: string;
}

interface ImportDropState {
  /** Un fichier est en train d'être glissé au-dessus de la fenêtre. */
  dragging: boolean;
  /** Fichier déposé, en attente d'être lu par l'écran d'import. */
  pending: PendingImportFile | null;
  setDragging: (dragging: boolean) => void;
  setPending: (file: PendingImportFile | null) => void;
}

export const useImportDropStore = create<ImportDropState>((set) => ({
  dragging: false,
  pending: null,
  setDragging: (dragging) => set({ dragging }),
  setPending: (pending) => set({ pending }),
}));
