/*
  # Task completion and escrow release functionality

  1. New Tables
    - `task_submissions`
      - Stores work submissions from executors
      - Links to tasks and includes submission details
      - Tracks submission status and review feedback

  2. Changes
    - Add submission handling to escrow release process
    - Add review functionality for task creators

  3. Security
    - Enable RLS on new table
    - Add policies for task participants
*/

-- Create task submissions table
CREATE TABLE task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) NOT NULL,
  executor_id uuid REFERENCES profiles(id) NOT NULL,
  content text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

-- Create policies for task submissions
CREATE POLICY "Task participants can view submissions"
  ON task_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_submissions.task_id
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

CREATE POLICY "Executors can create submissions"
  ON task_submissions FOR INSERT
  WITH CHECK (
    executor_id IN (
      SELECT id FROM profiles 
      WHERE pi_user_id = auth.uid()::text
    )
    AND
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_id
      AND tasks.executor_id = executor_id
      AND tasks.status = 'in_progress'
    )
  );

CREATE POLICY "Task creators can update submissions"
  ON task_submissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_submissions.task_id
      AND tasks.creator_id IN (
        SELECT id FROM profiles 
        WHERE pi_user_id = auth.uid()::text
      )
    )
  );

-- Function to submit task completion
CREATE OR REPLACE FUNCTION submit_task_completion(
  p_task_id uuid,
  p_content text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_executor_id uuid;
  v_submission_id uuid;
BEGIN
  -- Get executor ID
  SELECT executor_id INTO v_executor_id
  FROM tasks
  WHERE id = p_task_id
  AND status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found or not in progress';
  END IF;

  -- Create submission
  INSERT INTO task_submissions (
    task_id,
    executor_id,
    content,
    status
  )
  VALUES (
    p_task_id,
    v_executor_id,
    p_content,
    'pending'
  )
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$;

-- Function to review task submission
CREATE OR REPLACE FUNCTION review_task_submission(
  p_task_id uuid,
  p_submission_id uuid,
  p_approved boolean,
  p_feedback text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_escrow_id uuid;
BEGIN
  -- Get escrow payment ID
  SELECT id INTO v_escrow_id
  FROM escrow_payments
  WHERE task_id = p_task_id
  AND status = 'funded'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No funded escrow payment found for task';
  END IF;

  -- Update submission
  UPDATE task_submissions
  SET 
    status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    feedback = p_feedback,
    updated_at = now()
  WHERE id = p_submission_id
  AND task_id = p_task_id;

  -- If approved, release escrow payment
  IF p_approved THEN
    PERFORM release_escrow_payment(p_task_id, v_escrow_id);
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION submit_task_completion TO authenticated;
GRANT EXECUTE ON FUNCTION review_task_submission TO authenticated;