-- Regular bills (rent, internet, phone, subscriptions). `first_due` is the date of one payment; the others fall
-- every `every_months` months from it, until `end_date` if there is one. `plan_amount` and `plan_drop` are a
-- what-if the user is weighing (a cheaper price, or dropping the bill); they never change the bill itself.
CREATE TABLE bills (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  amount       NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  every_months INT NOT NULL CHECK (every_months IN (1, 3, 6, 12)),
  first_due    DATE NOT NULL,
  end_date     DATE,
  group_name   TEXT NOT NULL DEFAULT 'Other',
  account_id   BIGINT REFERENCES accounts(id) ON DELETE SET NULL,
  note         TEXT,
  plan_amount  NUMERIC(18,2) CHECK (plan_amount >= 0),
  plan_drop    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX bills_user_idx ON bills(user_id);
