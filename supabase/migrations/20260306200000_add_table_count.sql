-- Add table_count column to shops
-- Stores the number of tables configured for the restaurant.
-- Used by the table management screen to render the table grid.

ALTER TABLE shops ADD COLUMN table_count INTEGER NOT NULL DEFAULT 10;
