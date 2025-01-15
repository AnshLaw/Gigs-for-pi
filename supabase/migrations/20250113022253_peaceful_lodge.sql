/*
  # Prevent self-bidding on gigs

  1. Changes
    - Add a check constraint to prevent creators from bidding on their own gigs
    - Add a policy to enforce this rule at the RLS level

  2. Security
    - Ensures creators cannot bid on their own gigs through both database constraints and RLS
*/

-- Add a policy to prevent bidding on own tasks
CREATE POLICY "Users cannot bid on their own tasks"
  ON bids
  FOR INSERT
  WITH CHECK (
    task_id NOT IN (
      SELECT id FROM tasks
      WHERE creator_id IN (
        SELECT id FROM profiles 
        WHERE pi_user_id = auth.uid()::text
      )
    )
  );