CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  currency      CHAR(3) NOT NULL DEFAULT 'THB',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only a hash of the session token is stored, so a leaked table cannot be replayed.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

-- One row per asset. `kind` is free text on purpose: asset types are added one by one.
CREATE TABLE accounts (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'other',
  archived   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts(user_id);

-- A dated snapshot of an account: what it is worth, and the net money paid in
-- (negative: taken out) since the previous snapshot. Contributions are what
-- separate performance from simply adding more money.
CREATE TABLE entries (
  id           BIGSERIAL PRIMARY KEY,
  account_id   BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  value        NUMERIC(18,2) NOT NULL,
  contribution NUMERIC(18,2) NOT NULL DEFAULT 0,
  note         TEXT,
  UNIQUE (account_id, date)
);
