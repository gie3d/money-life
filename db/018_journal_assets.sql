-- The assets an entry is about: how it felt for some or all of them. An entry with none is about everything.
CREATE TABLE journal_entry_assets (
  entry_id   BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, account_id)
);
