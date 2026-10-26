-- Each asset is described three ways: what it is (category), the kind of holding (type)
-- and how fast it turns into cash (liquidity).
ALTER TABLE accounts RENAME COLUMN kind TO category;
ALTER TABLE accounts ADD COLUMN type TEXT NOT NULL DEFAULT 'investment';
ALTER TABLE accounts ADD COLUMN liquidity TEXT NOT NULL DEFAULT 'immediate';

UPDATE accounts SET category = CASE category
  WHEN 'investment' THEN 'funds'
  WHEN 'property' THEN 'real_estate'
  WHEN 'retirement' THEN 'other'
  ELSE category END;
