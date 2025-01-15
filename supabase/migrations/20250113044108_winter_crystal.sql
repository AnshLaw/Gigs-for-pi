/*
  # Add messaging system

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `sender_id` (uuid, references profiles)
      - `content` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `messages` table
    - Add policies for message creation and viewing
*/

-- Create messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) NOT NULL,
  sender_id uuid REFERENCES profiles(id) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Only allow participants to view messages
CREATE POLICY "Task participants can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = messages.task_id
      AND (
        -- Creator can view
        tasks.creator_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
        OR
        -- Executor can view
        tasks.executor_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
      )
    )
  );

-- Only allow participants to send messages
CREATE POLICY "Task participants can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = messages.task_id
      AND (
        -- Creator can send
        tasks.creator_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
        OR
        -- Executor can send
        tasks.executor_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
      )
    )
  );