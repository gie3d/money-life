-- Categories belong to the user instead of being a fixed list.
CREATE TABLE categories (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX categories_user_name_idx ON categories(user_id, lower(name));

-- Keep whatever categories existing assets already use.
INSERT INTO categories (user_id, name)
SELECT DISTINCT user_id, CASE category
  WHEN 'cash' THEN 'Cash & deposits' WHEN 'stocks' THEN 'Stocks' WHEN 'funds' THEN 'Funds'
  WHEN 'bonds' THEN 'Bonds' WHEN 'gold' THEN 'Gold' WHEN 'crypto' THEN 'Crypto'
  WHEN 'real_estate' THEN 'Real estate' ELSE 'Other' END
FROM accounts;

-- Everyone else starts with the same handful the signup now creates.
INSERT INTO categories (user_id, name)
SELECT u.id, d.name FROM users u
CROSS JOIN (VALUES ('Cash & deposits'), ('Stocks'), ('Funds'), ('Bonds'), ('Gold'), ('Crypto'), ('Real estate')) AS d(name)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.user_id = u.id)
ON CONFLICT DO NOTHING;

ALTER TABLE accounts ADD COLUMN category_id BIGINT REFERENCES categories(id) ON DELETE RESTRICT;
UPDATE accounts a SET category_id = c.id FROM categories c
WHERE c.user_id = a.user_id AND lower(c.name) = lower(CASE a.category
  WHEN 'cash' THEN 'Cash & deposits' WHEN 'stocks' THEN 'Stocks' WHEN 'funds' THEN 'Funds'
  WHEN 'bonds' THEN 'Bonds' WHEN 'gold' THEN 'Gold' WHEN 'crypto' THEN 'Crypto'
  WHEN 'real_estate' THEN 'Real estate' ELSE 'Other' END);
ALTER TABLE accounts ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE accounts DROP COLUMN category;
CREATE INDEX accounts_category_idx ON accounts(category_id);
