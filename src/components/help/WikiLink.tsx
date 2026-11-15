import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';

/** Lien « En savoir plus » vers une page du wiki intégré (`/aide/<page>`). */
export function WikiLink({ page, children = 'En savoir plus' }: { page: string; children?: React.ReactNode }) {
  return (
    <Link to={`/aide/${page}`} className="inline-flex items-center gap-1 text-lagon-600 dark:text-lagon-400 hover:underline">
      <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
      {children}
    </Link>
  );
}
