-- A plan is either an expense (a car, a trip: its items are costs) or income (a salary, a bonus: its items are income).
ALTER TABLE plans ADD COLUMN kind TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'income'));

-- Plans that only hold income become income plans.
UPDATE plans p SET kind = 'income'
WHERE EXISTS (SELECT 1 FROM plan_items i WHERE i.plan_id = p.id AND i.kind = 'income')
  AND NOT EXISTS (SELECT 1 FROM plan_items i WHERE i.plan_id = p.id AND i.kind = 'cost');

-- A plan that mixed both keeps its costs; its income moves to a new income plan beside it.
DO $$
DECLARE r RECORD; new_id BIGINT;
BEGIN
  FOR r IN SELECT p.id, p.user_id, p.name, p.archived FROM plans p
           WHERE p.kind = 'expense' AND EXISTS (SELECT 1 FROM plan_items i WHERE i.plan_id = p.id AND i.kind = 'income') LOOP
    INSERT INTO plans (user_id, name, kind, archived) VALUES (r.user_id, left(r.name || ' income', 80), 'income', r.archived) RETURNING id INTO new_id;
    UPDATE plan_items SET plan_id = new_id WHERE plan_id = r.id AND kind = 'income';
  END LOOP;
END $$;
