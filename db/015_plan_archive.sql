-- A plan can be put aside without deleting it: archived plans leave the Plans page and the forecast but are kept.
ALTER TABLE plans ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;
