-- Spending plans: a goal (a car, a trip) made of costs spread over dates, paid from chosen assets.
CREATE TABLE plans (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  -- Money you expect to set aside each month towards the plan, on top of the funds you already have.
  monthly_saving NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (monthly_saving >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX plans_user_idx ON plans(user_id);

-- One cost, once or repeating: `occurrences` payments starting on `start_date`.
CREATE TABLE plan_items (
  id          BIGSERIAL PRIMARY KEY,
  plan_id     BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  frequency   TEXT NOT NULL CHECK (frequency IN ('once', 'monthly', 'yearly')),
  start_date  DATE NOT NULL,
  occurrences INT NOT NULL DEFAULT 1 CHECK (occurrences BETWEEN 1 AND 600)
);
CREATE INDEX plan_items_plan_idx ON plan_items(plan_id);

-- The assets whose current value pays for the plan.
CREATE TABLE plan_assets (
  plan_id    BIGINT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, account_id)
);
