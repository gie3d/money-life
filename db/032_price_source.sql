-- Where to look up an investment's latest price: a web page or JSON API, and optionally how to find the number in
-- it (a dot path into JSON, or a regex whose first group is the price). Fetching only fills the Update box; the user saves.
ALTER TABLE accounts ADD COLUMN price_url TEXT;
ALTER TABLE accounts ADD COLUMN price_extract TEXT;
