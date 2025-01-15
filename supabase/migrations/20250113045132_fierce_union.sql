/*
  # Add attachments support for messages

  1. New Tables
    - `attachments`
      - `id` (uuid, primary key)
      - `message_id` (uuid, references messages)
      - `file_path` (text)
      - `file_name` (text)
      - `file_type` (text)
      - `file_size` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on attachments table
    - Add policies for task participants to view and create attachments
*/

-- Create attachments table
CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES messages(id) NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- Only allow participants to view attachments
CREATE POLICY "Task participants can view attachments"
  ON attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN tasks t ON t.id = m.task_id
      WHERE m.id = attachments.message_id
      AND (
        t.creator_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
        OR
        t.executor_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
      )
    )
  );

-- Only allow participants to create attachments
CREATE POLICY "Task participants can create attachments"
  ON attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN tasks t ON t.id = m.task_id
      WHERE m.id = message_id
      AND (
        t.creator_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
        OR
        t.executor_id IN (
          SELECT id FROM profiles 
          WHERE pi_user_id = auth.uid()::text
        )
      )
    )
  );