-- The share of the total value the user aims to keep in each category, in percent; null for no target.
ALTER TABLE categories ADD COLUMN target_pct NUMERIC(5,2) CHECK (target_pct >= 0 AND target_pct <= 100);
