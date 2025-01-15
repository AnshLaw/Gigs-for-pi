/*
  # Add function to handle bid acceptance

  This migration adds a stored procedure that handles the bid acceptance process:
  1. Updates the accepted bid status
  2. Rejects all other bids for the task
  3. Updates the task status and executor
*/

CREATE OR REPLACE FUNCTION accept_bid(
  p_task_id uuid,
  p_bid_id uuid,
  p_executor_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify task is still open
  IF NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE id = p_task_id
    AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Task is not available for bid acceptance';
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

  -- Update task status and executor
  UPDATE tasks
  SET 
    status = 'in_progress',
    executor_id = p_executor_id
  WHERE id = p_task_id;
END;
$$;