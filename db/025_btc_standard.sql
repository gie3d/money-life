-- BTC Standard: show every amount in BTC, converted on the fly from the prices of the assets under the BTC category.
ALTER TABLE users ADD COLUMN btc_standard BOOLEAN NOT NULL DEFAULT false;
