-- A private journal: how life and money felt in a period, written in Markdown and dated, to look back on.
CREATE TABLE journal_entries (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  title      TEXT NOT NULL,
  mood       TEXT,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX journal_entries_user_date ON journal_entries (user_id, entry_date DESC, id DESC);
