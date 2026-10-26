-- Each category has a colour, used wherever it is charted.
ALTER TABLE categories ADD COLUMN color TEXT NOT NULL DEFAULT '#8e8e93' CHECK (color ~ '^#[0-9a-fA-F]{6}$');

-- Give existing categories distinct colours, in the order they were created.
UPDATE categories c SET color = (
  ARRAY['#fd6217','#0a84ff','#30b455','#af52de','#e0a800','#ff375f','#32aadf','#8e8e93','#00a693','#7c5cff']
)[1 + (n.rn - 1) % 10]
FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY id) AS rn FROM categories) n
WHERE n.id = c.id;
