-- Tax plans: ways of working out a year's Thai personal income tax. A user can keep several plans for the same
-- year (what if I put more into RMF?). `deductions` holds what is claimed, as typed; lib/tax.ts caps it.
CREATE TABLE tax_plans (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  name        TEXT NOT NULL,
  deductions  JSONB NOT NULL DEFAULT '{}',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tax_plans_user_idx ON tax_plans(user_id, year);

-- The year's income, one row per source. `type` is the Section 40 type (40_1 .. 40_8); `kind` picks the standard
-- expense rate where a type has several; `actual_expense` replaces that rate when set.
CREATE TABLE tax_incomes (
  id              BIGSERIAL PRIMARY KEY,
  plan_id         BIGINT NOT NULL REFERENCES tax_plans(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('40_1','40_2','40_3','40_4','40_5','40_6','40_7','40_8')),
  name            TEXT NOT NULL,
  amount          NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  kind            TEXT,
  actual_expense  NUMERIC(18,2) CHECK (actual_expense >= 0),
  withheld        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (withheld >= 0),
  separate        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tax_incomes_plan_idx ON tax_incomes(plan_id);
