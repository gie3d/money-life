-- Money spent, in two kinds: everyday life (looked at month by month) and hobbies such as trips and gadgets (looked at
-- year by year). `category` is free text with suggestions, like a bill's group; `name` says what it was for.
CREATE TABLE spendings (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('everyday', 'hobby')),
  spent_on   DATE NOT NULL,
  amount     NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  category   TEXT NOT NULL DEFAULT 'Other',
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX spendings_user_kind_date ON spendings (user_id, kind, spent_on DESC, id DESC);
