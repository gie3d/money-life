-- Everyday spending is now one total per category per month, not each purchase: the day-to-day lives in another app.
-- Categories are the user's own list. Removing one that has amounts archives it, so past months keep their totals.
CREATE TABLE spending_categories (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  archived   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX spending_categories_user_name ON spending_categories (user_id, lower(name));

-- `month` is the first day of the month.
CREATE TABLE monthly_spending (
  category_id BIGINT NOT NULL REFERENCES spending_categories(id) ON DELETE CASCADE,
  month       DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  amount      NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (category_id, month)
);

-- Carry over anything already recorded as single purchases, summed by month.
INSERT INTO spending_categories (user_id, name, position)
SELECT user_id, min(category), (row_number() OVER (PARTITION BY user_id ORDER BY sum(amount) DESC))::int
FROM spendings WHERE kind = 'everyday' GROUP BY user_id, lower(category);

INSERT INTO monthly_spending (category_id, month, amount)
SELECT c.id, date_trunc('month', s.spent_on)::date, sum(s.amount)
FROM spendings s JOIN spending_categories c ON c.user_id = s.user_id AND lower(c.name) = lower(s.category)
WHERE s.kind = 'everyday' GROUP BY c.id, date_trunc('month', s.spent_on);

DELETE FROM spendings WHERE kind = 'everyday';
