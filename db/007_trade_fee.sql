-- Trading fee for a trade, as an amount in the user's currency.
ALTER TABLE transactions ADD COLUMN fee NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (fee >= 0);
