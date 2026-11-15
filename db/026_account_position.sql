-- The user's own order of assets within a category (drag and drop on the Assets page).
ALTER TABLE accounts ADD COLUMN position INT NOT NULL DEFAULT 0;
UPDATE accounts a SET position = r.pos
FROM (SELECT id, row_number() OVER (PARTITION BY user_id, category_id ORDER BY created_at, id) AS pos FROM accounts) r
WHERE a.id = r.id;
