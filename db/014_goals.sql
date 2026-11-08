-- Goals: money to build up by a date, like retirement or a child's education. A goal names the assets that count
-- towards it; its plan (assumptions, contributions, target) lives in versions, so revising the plan keeps the
-- earlier ones to compare against. `start_value` is what the assets were worth on `start_date` when the version
-- was made, kept fixed so later edits to records don't move the baseline.
CREATE TABLE goals (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('retirement', 'other')),
  birth_date  DATE,
  retire_age  INT CHECK (retire_age BETWEEN 30 AND 100),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX goals_user_idx ON goals(user_id);

CREATE TABLE goal_assets (
  goal_id    BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (goal_id, account_id)
);

CREATE TABLE goal_versions (
  id                   BIGSERIAL PRIMARY KEY,
  goal_id              BIGINT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  start_date           DATE NOT NULL,
  start_value          NUMERIC(18,2) NOT NULL,
  target_date          DATE NOT NULL,
  target_mode          TEXT NOT NULL CHECK (target_mode IN ('amount', 'spending')),
  target_amount        NUMERIC(18,2),
  monthly_spending     NUMERIC(18,2),
  withdrawal_rate      NUMERIC(6,4) NOT NULL DEFAULT 0.04,
  expected_return      NUMERIC(6,4) NOT NULL,
  inflation            NUMERIC(6,4) NOT NULL DEFAULT 0,
  monthly_contribution NUMERIC(18,2) NOT NULL DEFAULT 0,
  contribution_growth  NUMERIC(6,4) NOT NULL DEFAULT 0,
  note                 TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (target_date > start_date)
);
CREATE INDEX goal_versions_goal_idx ON goal_versions(goal_id, created_at);
