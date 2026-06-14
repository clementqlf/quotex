-- Migration: Enable Supabase Realtime for Book and Author tables
-- Date: 2026-06-14

DO $$
BEGIN
  -- Enable Realtime for Book if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'Book'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Book";
  END IF;

  -- Enable Realtime for Author if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'Author'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Author";
  END IF;
END $$;
