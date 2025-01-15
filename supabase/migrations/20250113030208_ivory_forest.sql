/*
  # Fix COALESCE type mismatch in trigger

  1. Changes
    - Fix type mismatch in prevent_duplicate_bids function
    - Update trigger to handle NULL id values correctly

  2. Security
    - Maintains existing RLS policies
    - No security changes
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS prevent_duplicate_bids_trigger ON bids;
DROP FUNCTION IF EXISTS prevent_duplicate_bids;

-- Create updated function to prevent duplicate bids
CREATE OR REPLACE FUNCTION prevent_duplicate_bids()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bids
    WHERE task_id = NEW.task_id
    AND bidder_id = NEW.bidder_id
    AND id IS DISTINCT FROM NEW.id
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