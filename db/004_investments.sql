-- Investments are tracked by trades (buy and sell), not by balances.
CREATE TABLE transactions (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  side       TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity   NUMERIC(24,8) NOT NULL CHECK (quantity > 0),
  price      NUMERIC(24,8) NOT NULL CHECK (price >= 0),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_account_idx ON transactions(account_id, date);

-- Market price of one unit on a date. Entered by hand for now; a price feed can write here later.
CREATE TABLE prices (
  id         BIGSERIAL PRIMARY KEY,
  account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  price      NUMERIC(24,8) NOT NULL CHECK (price >= 0),
  UNIQUE (account_id, date)
);
