-- What came in each month (salary, side income: whatever was earned), typed next to the month's spending.
-- One amount per user per month; `month` is the first day of the month.
CREATE TABLE monthly_income (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month   DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  amount  NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
  PRIMARY KEY (user_id, month)
);
