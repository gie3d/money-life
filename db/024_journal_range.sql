-- An entry covers a period: it starts on entry_date and runs to end_date (none means up to today).
ALTER TABLE journal_entries ADD COLUMN end_date DATE;
ALTER TABLE journal_entries ADD CONSTRAINT journal_range_order CHECK (end_date IS NULL OR end_date >= entry_date);
