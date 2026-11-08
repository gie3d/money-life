-- Units moved from one investment to another (say BTC from an exchange to a wallet), with an optional fee in
-- units taken from the sender. Stored once, as entered: each asset's side, with its share of the cost, is
-- worked out whenever trades are read, so edits and entries out of date order stay right.
CREATE TABLE transfers (
  id              BIGSERIAL PRIMARY KEY,
  from_account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id   BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  units           NUMERIC(24,8) NOT NULL CHECK (units > 0),
  fee             NUMERIC(24,8) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX transfers_from_idx ON transfers(from_account_id, date);
CREATE INDEX transfers_to_idx ON transfers(to_account_id, date);
