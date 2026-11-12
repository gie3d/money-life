-- How necessary a category is: must (can't skip it), need (important, some room), want (nice to have).
-- Empty until the user sorts it, so nothing is silently counted as something it isn't.
ALTER TABLE spending_categories ADD COLUMN tier TEXT CHECK (tier IN ('must', 'need', 'want'));
