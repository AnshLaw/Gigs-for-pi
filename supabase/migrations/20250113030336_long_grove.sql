/*
  # Improve bid validation

  1. Changes
    - Drop existing trigger and function
    - Create new trigger with improved validation
    - Add explicit check for task status
    - Add explicit check for self-bidding

  2. Security
    - Maintains existing RLS policies
    - Adds additional validation checks
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS prevent_duplicate_bids_trigger ON bids;
DROP FUNCTION IF EXISTS prevent_duplicate_bids;

-- Create improved function to prevent invalid bids
CREATE OR REPLACE FUNCTION validate_bid()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if task exists and is open
  IF NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE id = NEW.task_id
    AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Task is not available for bidding';
  END IF;

  -- Check if user is trying to bid on their own task
  IF EXISTS (
    SELECT 1 FROM tasks
    WHERE id = NEW.task_id
    AND creator_id = NEW.bidder_id
  ) THEN
    RAISE EXCEPTION 'You cannot bid on your own task';
  END IF;

  -- Check for existing bid
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
CREATE TRIGGER validate_bid_trigger
  BEFORE INSERT OR UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION validate_bid();