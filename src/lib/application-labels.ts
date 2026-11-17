/**
 * Statuts et sources des candidatures : codes, libellés et colonnes du kanban.
 * Source unique pour l'import de tableaux, l'export et le kanban. Pur.
 */
import type { ApplicationSource, ApplicationStatus } from '@/types/application';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'draft', 'applied', 'acknowledged', 'phone_screen', 'interview', 'technical_test',
  'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted',
];

export const STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  draft: 'Brouillon',
  applied: 'Postulé',
  acknowledged: 'Accusé de réception',
  phone_screen: 'Pré-qualification',
  interview: 'Entretien',
  technical_test: 'Test technique',
  offer: 'Offre reçue',
  accepted: 'Accepté',
  rejected: 'Refusé',
  withdrawn: 'Retiré',
  ghosted: 'Sans réponse',
};

export const APPLICATION_SOURCES: readonly ApplicationSource[] = ['job_board', 'spontaneous', 'network', 'recruiter', 'linkedin', 'other'];

export const SOURCE_LABELS: Readonly<Record<ApplicationSource, string>> = {
  job_board: 'Site d\'offres d\'emploi',
  spontaneous: 'Candidature spontanée',
  network: 'Réseau',
  recruiter: 'Recruteur',
  linkedin: 'LinkedIn',
  other: 'Autre',
};

export interface KanbanColumnDef {
  id: string;
  title: string;
  statuses: readonly ApplicationStatus[];
}

/** Colonnes du kanban et statuts qu'elles regroupent. */
export const KANBAN_COLUMNS: readonly KanbanColumnDef[] = [
  { id: 'draft', title: 'Brouillon', statuses: ['draft'] },
  { id: 'applied', title: 'Postulé', statuses: ['applied', 'acknowledged'] },
  { id: 'in_progress', title: 'En cours', statuses: ['phone_screen', 'technical_test'] },
  { id: 'interview', title: 'Entretien', statuses: ['interview'] },
  { id: 'offer', title: 'Offre', statuses: ['offer'] },
  { id: 'done', title: 'Terminé', statuses: ['accepted', 'rejected', 'withdrawn', 'ghosted'] },
];

/** Colonne du kanban où s'affiche un statut. */
export function kanbanColumnOf(status: ApplicationStatus): KanbanColumnDef {
  return KANBAN_COLUMNS.find(c => c.statuses.includes(status)) ?? KANBAN_COLUMNS[0];
}
