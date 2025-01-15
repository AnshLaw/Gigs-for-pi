/*
  # Add one bid per user restriction

  1. Changes
    - Remove duplicate bids keeping only the latest one
    - Add unique constraint to prevent multiple bids from the same user on a task
    - Add trigger to handle the constraint violation gracefully

  2. Security
    - Maintains existing RLS policies
    - Adds additional validation layer
*/

-- First, remove duplicate bids keeping only the latest one
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

-- Now we can safely add the unique constraint
ALTER TABLE bids
ADD CONSTRAINT one_bid_per_user_per_task UNIQUE (task_id, bidder_id);

-- Create function to handle bid updates
CREATE OR REPLACE FUNCTION handle_bid_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If there's an existing bid from this user for this task, raise an error
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

-- Create trigger for bid updates
CREATE TRIGGER check_one_bid_per_user
  BEFORE INSERT OR UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION handle_bid_update();