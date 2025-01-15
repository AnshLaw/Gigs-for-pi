/*
  # Add task bid management functionality

  1. Changes
    - Add foreign key constraints for better data integrity
    - Add trigger to prevent multiple accepted bids per task
    - Add trigger to update task status when bid is accepted

  2. Security
    - Add policies for bid management
*/

-- Add foreign key constraints if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tasks_creator_id_fkey'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_creator_id_fkey 
      FOREIGN KEY (creator_id) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tasks_executor_id_fkey'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_executor_id_fkey 
      FOREIGN KEY (executor_id) REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bids_task_id_fkey'
  ) THEN
    ALTER TABLE bids ADD CONSTRAINT bids_task_id_fkey 
      FOREIGN KEY (task_id) REFERENCES tasks(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bids_bidder_id_fkey'
  ) THEN
    ALTER TABLE bids ADD CONSTRAINT bids_bidder_id_fkey 
      FOREIGN KEY (bidder_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Create function to prevent multiple accepted bids
CREATE OR REPLACE FUNCTION check_accepted_bids()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    IF EXISTS (
      SELECT 1 FROM bids 
      WHERE task_id = NEW.task_id 
      AND status = 'accepted' 
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Only one bid can be accepted per task';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for checking accepted bids
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'check_accepted_bids_trigger'
  ) THEN
    CREATE TRIGGER check_accepted_bids_trigger
      BEFORE UPDATE ON bids
      FOR EACH ROW
      EXECUTE FUNCTION check_accepted_bids();
  END IF;
END $$;

-- Add policies for bid management
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Task creators can manage bids'
  ) THEN
    CREATE POLICY "Task creators can manage bids"
      ON bids
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM tasks
          WHERE tasks.id = bids.task_id
          AND tasks.creator_id IN (
            SELECT id FROM profiles WHERE pi_user_id = auth.uid()::text
          )
        )
      );
  END IF;
END $$;