import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { wikiPageForPath } from '@/content/help';

/** F1 : ouvre dans l'aide la page du wiki correspondant à l'écran en cours. */
export function GlobalHelpShortcut() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F1' || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (location.pathname.startsWith('/aide')) return;
      navigate(`/aide/${wikiPageForPath(location.pathname)}`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [location.pathname, navigate]);

  return null;
}
