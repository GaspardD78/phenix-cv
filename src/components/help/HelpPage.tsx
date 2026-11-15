import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search } from 'lucide-react';
import { WIKI } from '@/content';
import { findWikiPage, searchWiki, wikiGroups, type WikiPage } from '@/lib/wiki';

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 text-[var(--pc-text)]">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-7 mb-2 text-[var(--pc-text)]">{children}</h2>,
  p: ({ children }) => <p className="mb-3 leading-relaxed text-[var(--pc-text)]">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-[var(--pc-text)]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-[var(--pc-text)]">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[var(--pc-text)]">{children}</strong>,
  a: ({ href, children }) =>
    href?.startsWith('/aide/')
      ? <Link to={href} className="text-[var(--pc-accent)] underline underline-offset-2 hover:text-[var(--pc-accent-hover)]">{children}</Link>
      : <span>{children}</span>,
};

function Article({ page }: { page: WikiPage }) {
  return (
    <article id={page.id} data-testid="wiki-article" className="max-w-2xl text-[15px] text-[var(--pc-text)]">
      <h1 className="text-2xl font-bold mb-3 text-[var(--pc-text)]">{page.title}</h1>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{page.body}</ReactMarkdown>
    </article>
  );
}

/** Aide : sommaire, recherche plein texte et une page par sujet (ancre = `/aide/<identifiant>`). */
export function HelpPage() {
  const { page: pageId } = useParams<{ page?: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => wikiGroups(WIKI.pages), []);
  const current = findWikiPage(WIKI.pages, pageId);
  const hits = useMemo(() => (query.trim() ? searchWiki(WIKI.pages, query) : []), [query]);

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden bg-[var(--pc-bg)]">
      <aside className="md:w-72 md:flex-shrink-0 border-b md:border-b-0 md:border-r border-[var(--pc-border)] bg-[var(--pc-surface)] p-4 md:overflow-y-auto">
        <h1 className="text-xl font-bold mb-3 text-[var(--pc-text)]">Aide</h1>
        <label htmlFor="wiki-search" className="sr-only">Rechercher dans l'aide</label>
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[var(--pc-muted)]" aria-hidden="true" />
          <input
            id="wiki-search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher, par exemple « dates »"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-[var(--pc-border-active)] bg-[var(--pc-card)] text-[var(--pc-text)] placeholder:text-[var(--pc-muted)] outline-none focus:border-[var(--pc-accent)]"
          />
        </div>

        {query.trim() ? (
          <ul className="space-y-3" data-testid="wiki-results">
            {hits.length === 0 && <li className="text-sm text-[var(--pc-muted)]">Aucun résultat pour « {query} ». Essayez d'autres mots.</li>}
            {hits.map(h => (
              <li key={h.page.id}>
                <button onClick={() => { setQuery(''); navigate(`/aide/${h.page.id}`); }} className="text-left w-full">
                  <span className="block text-sm font-semibold text-[var(--pc-accent)] hover:underline">{h.page.title}</span>
                  <span className="block text-xs text-[var(--pc-muted)] mt-0.5">{h.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <nav aria-label="Sommaire de l'aide">
            {groups.map(g => (
              <div key={g.group} className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pc-muted)] mb-1">{g.group}</p>
                <ul>
                  {g.pages.map(p => (
                    <li key={p.id}>
                      <Link
                        to={`/aide/${p.id}`}
                        aria-current={current?.id === p.id ? 'page' : undefined}
                        className={`block px-2 py-1.5 rounded-md text-sm ${
                          current?.id === p.id
                            ? 'bg-[var(--pc-accent-subtle)] text-[var(--pc-accent)] font-medium'
                            : 'text-[var(--pc-text)] hover:bg-[var(--pc-hover)]'
                        }`}
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-6 md:p-10">
        {current ? (
          <Article page={current} />
        ) : (
          <div className="max-w-2xl text-[var(--pc-text)]">
            <h2 className="text-xl font-semibold mb-2">Choisissez un sujet</h2>
            <p className="text-[var(--pc-muted)] leading-relaxed">
              Le sommaire, à gauche, regroupe les sujets par étape : votre profil, vos CV, le suivi de vos candidatures.
              Vous pouvez aussi taper un mot dans la recherche.
            </p>
            {pageId && <p className="mt-3 text-sm text-[var(--pc-muted)]">La page « {pageId} » n'existe pas. Choisissez un sujet dans le sommaire.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
