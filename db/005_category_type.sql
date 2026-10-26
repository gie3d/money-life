-- The type (cash, saving or investment) now belongs to the category, not to each asset.
ALTER TABLE categories ADD COLUMN type TEXT NOT NULL DEFAULT 'investment' CHECK (type IN ('cash', 'saving', 'investment'));

-- Keep the type existing assets already have.
UPDATE categories c SET type = a.type
FROM (SELECT DISTINCT ON (category_id) category_id, type FROM accounts ORDER BY category_id, id) a
WHERE a.category_id = c.id;

UPDATE categories c SET type = 'cash'
WHERE lower(c.name) = 'cash & deposits' AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.category_id = c.id);

ALTER TABLE accounts DROP COLUMN type;
