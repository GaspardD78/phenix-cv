-- Phénix CV : schéma initial unique.

CREATE TABLE profiles (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  postal_code   TEXT,
  country       TEXT DEFAULT 'France',
  linkedin_url  TEXT,
  github_url    TEXT,
  portfolio_url TEXT,
  photo_path    TEXT,
  title         TEXT,
  summary       TEXT,
  driving_license TEXT,
  header_extras TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE master_entries (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_type    TEXT NOT NULL CHECK (entry_type IN (
    'experience', 'education', 'skill', 'certification',
    'language', 'interest', 'project', 'volunteer'
  )),
  title         TEXT NOT NULL,
  subtitle      TEXT,
  location      TEXT,
  start_date    TEXT,
  end_date      TEXT,
  is_current    INTEGER DEFAULT 0,
  description   TEXT,
  metadata      TEXT DEFAULT '{}',
  sort_order    INTEGER DEFAULT 0,
  tags          TEXT DEFAULT '[]',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_entries_profile ON master_entries(profile_id);
CREATE INDEX idx_entries_type ON master_entries(entry_type);

CREATE TABLE cv_documents (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  template_id      TEXT NOT NULL DEFAULT 'ats-classic',
  target_job       TEXT,
  target_company   TEXT,
  custom_summary   TEXT,
  settings         TEXT DEFAULT '{}',
  is_favorite      INTEGER DEFAULT 0,
  last_exported    TEXT,
  markdown_content TEXT,
  markdown_mode    INTEGER NOT NULL DEFAULT 0 CHECK (markdown_mode IN (0, 1)),
  created_at       TEXT DEFAULT (datetime('now')),
  updated_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE cv_blocks (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  cv_id           TEXT NOT NULL REFERENCES cv_documents(id) ON DELETE CASCADE,
  entry_id        TEXT REFERENCES master_entries(id) ON DELETE SET NULL,
  block_type      TEXT NOT NULL,
  section_name    TEXT,
  custom_content  TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_visible      INTEGER DEFAULT 1,
  override_data   TEXT DEFAULT '{}',
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_blocks_cv ON cv_blocks(cv_id, sort_order);

CREATE TABLE applications (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id      TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cv_id           TEXT REFERENCES cv_documents(id) ON DELETE SET NULL,
  company_name    TEXT NOT NULL,
  job_title       TEXT NOT NULL,
  job_url         TEXT,
  source          TEXT CHECK (source IN (
    'job_board', 'spontaneous', 'network', 'recruiter', 'linkedin', 'other'
  )),
  source_detail   TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'applied', 'acknowledged', 'phone_screen', 'interview',
    'technical_test', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted'
  )),
  salary_min      INTEGER,
  salary_max      INTEGER,
  location        TEXT,
  remote_policy   TEXT,
  priority        INTEGER DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  notes           TEXT,
  applied_at      TEXT,
  next_action     TEXT,
  next_action_date TEXT,
  job_description TEXT,
  rejection_reason TEXT,
  rejection_email TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_apps_status ON applications(status);
CREATE INDEX idx_apps_profile ON applications(profile_id);

CREATE TABLE application_events (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'status_change', 'note', 'email_sent', 'email_received',
    'call', 'interview', 'followup', 'document_sent', 'other'
  )),
  event_date      TEXT NOT NULL DEFAULT (datetime('now')),
  title           TEXT NOT NULL,
  description     TEXT,
  old_status      TEXT,
  new_status      TEXT,
  calendar_id     TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_app ON application_events(application_id, event_date);

CREATE TABLE application_attachments (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  application_id  TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,
  file_type       TEXT,
  file_size       INTEGER,
  label           TEXT DEFAULT 'other' CHECK (label IN (
    'cv', 'cover_letter', 'portfolio', 'certificate', 'other'
  )),
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_attachments_app ON application_attachments(application_id);

CREATE TABLE compatibility_scores (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  application_id       TEXT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
  cv_id                TEXT NOT NULL,
  score_global         INTEGER NOT NULL,
  score_skills         INTEGER NOT NULL,
  score_experience     INTEGER NOT NULL,
  score_education      INTEGER NOT NULL,
  score_keywords       INTEGER NOT NULL,
  details              TEXT NOT NULL,
  cv_content_hash      TEXT NOT NULL,
  job_description_hash TEXT NOT NULL,
  computed_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_compat_scores_app ON compatibility_scores(application_id);

CREATE TABLE entry_variant_history (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  master_entry_id   TEXT NOT NULL REFERENCES master_entries(id) ON DELETE CASCADE,
  source_cv_id      TEXT REFERENCES cv_documents(id) ON DELETE SET NULL,
  source_cv_name    TEXT,
  raw_title         TEXT,
  raw_subtitle      TEXT,
  raw_location      TEXT,
  raw_start_date    TEXT,
  raw_end_date      TEXT,
  raw_is_current    INTEGER DEFAULT 0,
  raw_description   TEXT,
  match_score       REAL,
  match_criteria    TEXT DEFAULT '{}',
  resolution        TEXT NOT NULL CHECK (resolution IN ('merged', 'new_entry')),
  synced_at         TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_variant_history_entry ON entry_variant_history(master_entry_id, synced_at DESC);

CREATE TABLE duplicate_dismissals (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entry_id_a    TEXT NOT NULL REFERENCES master_entries(id) ON DELETE CASCADE,
  entry_id_b    TEXT NOT NULL REFERENCES master_entries(id) ON DELETE CASCADE,
  dismissed_at  TEXT DEFAULT (datetime('now')),
  UNIQUE (entry_id_a, entry_id_b),
  CHECK (entry_id_a < entry_id_b)
);

CREATE TABLE cv_angles (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id            TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slug                  TEXT NOT NULL,
  label                 TEXT NOT NULL,
  title_rule            TEXT NOT NULL DEFAULT 'profile',
  summary_structure     TEXT NOT NULL DEFAULT '',
  skill_category_order  TEXT NOT NULL DEFAULT '[]',
  vocabulary            TEXT NOT NULL DEFAULT '',
  older_policy          TEXT NOT NULL DEFAULT 'one-line',
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now')),
  UNIQUE (profile_id, slug)
);
CREATE INDEX idx_cv_angles_profile ON cv_angles(profile_id);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('default_template', 'ats-classic'),
  ('default_language', 'fr'),
  ('theme', 'light');
