-- Free text about an asset (where it is held, account numbers, why it was bought), written in Markdown.
ALTER TABLE accounts ADD COLUMN notes TEXT;
