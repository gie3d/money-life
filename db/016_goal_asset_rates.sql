-- Each asset in a goal's plan grows at its own expected rate and can have its own monthly amount put in. The
-- version's own expected_return / monthly_contribution / start_value stay as the combined figures (rate weighted by
-- value) for display; the plan itself is worked out asset by asset from these rows when they exist.
CREATE TABLE goal_version_assets (
  version_id           BIGINT NOT NULL REFERENCES goal_versions(id) ON DELETE CASCADE,
  account_id           BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  start_value          NUMERIC(18,2) NOT NULL DEFAULT 0,
  expected_return      NUMERIC(6,4) NOT NULL,
  monthly_contribution NUMERIC(18,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (version_id, account_id)
);
