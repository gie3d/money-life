-- A remark on one category in one month, e.g. "Trip to Chiang Mai". Separate from the amount so a remark can stand
-- without one, and clearing an amount doesn't lose it.
CREATE TABLE monthly_spending_notes (
  category_id BIGINT NOT NULL REFERENCES spending_categories(id) ON DELETE CASCADE,
  month       DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  note        TEXT NOT NULL CHECK (length(note) BETWEEN 1 AND 300),
  PRIMARY KEY (category_id, month)
);
