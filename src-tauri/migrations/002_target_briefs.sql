-- Fiches « Ce que le marché attend » : cache de la recherche par métier, secteur et entreprise.
-- Ne contient aucune donnée personnelle (le texte de recherche n'en contient pas) ; n'est pas
-- inclus dans les sauvegardes, la recherche pouvant être refaite.

CREATE TABLE target_briefs (
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cache_key     TEXT NOT NULL,
  role          TEXT NOT NULL,
  sector        TEXT,
  company       TEXT,
  brief         TEXT NOT NULL,
  researched_at TEXT NOT NULL,
  updated_at    TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, cache_key)
);
