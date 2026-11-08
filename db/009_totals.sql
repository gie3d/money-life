-- A "Total" entry for an investment: at the end of `date` the holding was `units` units that had cost
-- `cost` in all, and one unit was worth `price`. It is stored as entered, not as a trade: the buy or sale
-- it stands for (the change in units and cost since just before) is worked out afresh whenever trades are
-- read, so entries made out of date order, edited or deleted all stay right.
CREATE TABLE totals (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  units      NUMERIC(24,8) NOT NULL CHECK (units >= 0),
  cost       NUMERIC(18,2) NOT NULL CHECK (cost >= 0),
  price      NUMERIC(24,8) NOT NULL CHECK (price >= 0),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, date)
);
