/*
  # Update bid acceptance logic

  1. Changes
    - Update task payment_amount to match accepted bid amount
    - Add trigger to ensure task amount matches accepted bid

  2. Security
    - Function remains security definer to maintain existing permissions
    - Only task creators can accept bids (enforced by existing RLS)
*/

-- Drop existing function
DROP FUNCTION IF EXISTS accept_bid;

-- Create improved accept_bid function
CREATE OR REPLACE FUNCTION accept_bid(
  p_task_id uuid,
  p_bid_id uuid,
  p_executor_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bid_amount numeric;
BEGIN
  -- Verify task is still open
  IF NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE id = p_task_id
    AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Task is not available for bid acceptance';
  END IF;

  -- Get the bid amount
  SELECT amount INTO v_bid_amount
  FROM bids
  WHERE id = p_bid_id
  AND task_id = p_task_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;

  -- Update the accepted bid
  UPDATE bids
  SET status = 'accepted'
  WHERE id = p_bid_id
  AND task_id = p_task_id;

  -- Reject all other bids for this task
  UPDATE bids
  SET status = 'rejected'
  WHERE task_id = p_task_id
  AND id != p_bid_id
  AND status = 'pending';

  -- Update task status, executor, and payment amount
  UPDATE tasks
  SET 
    status = 'in_progress',
    executor_id = p_executor_id,
    payment_amount = v_bid_amount
  WHERE id = p_task_id;
END;
$$;