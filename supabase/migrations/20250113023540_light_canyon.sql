/*
  # Fix bid trigger function

  1. Changes
    - Remove COALESCE in trigger function and use proper UUID comparison
    - Simplify logic to rely on the unique constraint
  
  2. Security
    - Maintains existing security constraints
    - Ensures one bid per user per task
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS check_one_bid_per_user ON bids;
DROP FUNCTION IF EXISTS handle_bid_update;

-- Create updated function to handle bid updates
CREATE OR REPLACE FUNCTION handle_bid_update()
RETURNS TRIGGER AS $$
BEGIN
  -- For updates, allow updating the same bid
  IF TG_OP = 'UPDATE' AND NEW.id = OLD.id THEN
    RETURN NEW;
  END IF;

  -- Check for existing bids
  IF EXISTS (
    SELECT 1 FROM bids
    WHERE task_id = NEW.task_id
    AND bidder_id = NEW.bidder_id
    AND (
      TG_OP = 'INSERT' 
      OR 
      (TG_OP = 'UPDATE' AND id != NEW.id)
    )
  ) THEN
    RAISE EXCEPTION 'You can only place one bid per gig';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bid updates
CREATE TRIGGER check_one_bid_per_user
  BEFORE INSERT OR UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION handle_bid_update();