/*
  # Add delete policies for tasks and bids

  1. Changes
    - Add policy to allow task creators to delete their own tasks
    - Add policy to allow task creators to delete bids on their tasks
    - Add policy to allow bidders to delete their own bids

  2. Security
    - Only task creators can delete their own tasks
    - Only task creators can delete bids on their tasks
    - Only bidders can delete their own bids
*/

-- Add delete policy for tasks
CREATE POLICY "Task creators can delete their own tasks"
  ON tasks
  FOR DELETE
  USING (
    creator_id IN (
      SELECT id FROM profiles 
      WHERE pi_user_id = auth.uid()::text
    )
  );

-- Add delete policy for bids (for task creators)
CREATE POLICY "Task creators can delete bids on their tasks"
  ON bids
  FOR DELETE
  USING (
    task_id IN (
      SELECT id FROM tasks
      WHERE creator_id IN (
        SELECT id FROM profiles 
        WHERE pi_user_id = auth.uid()::text
      )
    )
  );

-- Add delete policy for bids (for bidders)
CREATE POLICY "Bidders can delete their own bids"
  ON bids
  FOR DELETE
  USING (
    bidder_id IN (
      SELECT id FROM profiles 
      WHERE pi_user_id = auth.uid()::text
    )
  );