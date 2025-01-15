/*
  # Fix duplicate bids issue

  1. Changes
    - Add unique constraint on task_id and bidder_id
    - Add trigger to prevent duplicate bids with custom error message
    - Clean up any existing duplicate bids

  2. Security
    - Maintains existing RLS policies
    - Adds database-level constraint for data integrity
*/

-- First, clean up any existing duplicate bids keeping only the latest one
WITH DuplicateBids AS (
  SELECT id
  FROM (
    SELECT 
      id,
      task_id,
      bidder_id,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY task_id, bidder_id 
        ORDER BY created_at DESC
      ) as rn
    FROM bids
  ) ranked
  WHERE rn > 1
)
DELETE FROM bids
WHERE id IN (SELECT id FROM DuplicateBids);

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS check_one_bid_per_user ON bids;
DROP FUNCTION IF EXISTS handle_bid_update;

-- Create function to prevent duplicate bids
CREATE OR REPLACE FUNCTION prevent_duplicate_bids()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bids
    WHERE task_id = NEW.task_id
    AND bidder_id = NEW.bidder_id
    AND id != COALESCE(NEW.id, -1)
  ) THEN
    RAISE EXCEPTION 'You can only place one bid per gig';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER prevent_duplicate_bids_trigger
  BEFORE INSERT OR UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_bids();

-- Add unique constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_bid_per_task_user'
  ) THEN
    ALTER TABLE bids
    ADD CONSTRAINT unique_bid_per_task_user 
    UNIQUE (task_id, bidder_id);
  END IF;
END $$;