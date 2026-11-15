-- A plan's items are costs, or now also income: money expected in, once (a bonus) or repeating (a salary).
ALTER TABLE plan_items ADD COLUMN kind TEXT NOT NULL DEFAULT 'cost' CHECK (kind IN ('cost', 'income'));
