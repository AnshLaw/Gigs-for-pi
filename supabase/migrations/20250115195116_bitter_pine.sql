-- Create escrow payments table
CREATE TABLE escrow_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) NOT NULL,
  bid_id uuid REFERENCES bids(id) NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_id text NOT NULL,
  txid text,
  status text NOT NULL CHECK (status IN ('pending', 'funded', 'released', 'refunded', 'disputed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE escrow_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for escrow payments
CREATE POLICY "Task participants can view escrow payments"
  ON escrow_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = escrow_payments.task_id
      AND (
        tasks.creator_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
        OR
        tasks.executor_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
      )
    )
  );

-- Function to handle escrow payment creation
CREATE OR REPLACE FUNCTION create_escrow_payment(
  p_task_id uuid,
  p_bid_id uuid,
  p_amount numeric,
  p_payment_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_escrow_id uuid;
BEGIN
  -- Insert escrow payment record
  INSERT INTO escrow_payments (
    task_id,
    bid_id,
    amount,
    payment_id,
    status
  )
  VALUES (
    p_task_id,
    p_bid_id,
    p_amount,
    p_payment_id,
    'pending'
  )
  RETURNING id INTO v_escrow_id;

  RETURN v_escrow_id;
END;
$$;

-- Function to update escrow payment status
CREATE OR REPLACE FUNCTION update_escrow_payment_status(
  p_escrow_id uuid,
  p_status text,
  p_txid text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate status
  IF p_status NOT IN ('pending', 'funded', 'released', 'refunded', 'disputed') THEN
    RAISE EXCEPTION 'Invalid escrow payment status';
  END IF;

  -- Update escrow payment
  UPDATE escrow_payments
  SET 
    status = p_status,
    txid = COALESCE(p_txid, txid),
    updated_at = now()
  WHERE id = p_escrow_id;
END;
$$;

-- Function to release escrow payment
CREATE OR REPLACE FUNCTION release_escrow_payment(
  p_task_id uuid,
  p_escrow_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify task status
  IF NOT EXISTS (
    SELECT 1 FROM tasks
    WHERE id = p_task_id
    AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Task is not in progress';
  END IF;

  -- Update escrow payment status
  UPDATE escrow_payments
  SET 
    status = 'released',
    updated_at = now()
  WHERE id = p_escrow_id
  AND task_id = p_task_id
  AND status = 'funded';

  -- Update task status
  UPDATE tasks
  SET status = 'completed'
  WHERE id = p_task_id;
END;
$$;

-- Function to handle bid acceptance with escrow
CREATE OR REPLACE FUNCTION accept_bid_with_escrow(
  p_task_id uuid,
  p_bid_id uuid,
  p_executor_id uuid,
  p_payment_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bid_amount numeric;
  v_escrow_id uuid;
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

  -- Create escrow payment
  v_escrow_id := create_escrow_payment(
    p_task_id,
    p_bid_id,
    v_bid_amount,
    p_payment_id
  );

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
    executor_id = p_executor_id,
    payment_amount = v_bid_amount
  WHERE id = p_task_id;

  RETURN v_escrow_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_escrow_payment TO authenticated;
GRANT EXECUTE ON FUNCTION update_escrow_payment_status TO authenticated;
GRANT EXECUTE ON FUNCTION release_escrow_payment TO authenticated;
GRANT EXECUTE ON FUNCTION accept_bid_with_escrow TO authenticated;