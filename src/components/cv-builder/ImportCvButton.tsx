// Bouton « Importer » de la liste « Mes CV ». Il reçoit la fonction de navigation
// en paramètre pour pouvoir être testé sans interface graphique.
export function ImportCvButton({ navigate }: { navigate: (to: string) => void }) {
  return (
    <button className="pc-btn-secondary" onClick={() => navigate('/import')}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 17" /><polyline points="17 6 23 6 23 12" />
      </svg>
      Importer
    </button>
  );
}
