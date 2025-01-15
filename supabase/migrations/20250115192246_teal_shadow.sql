/*
  # Add support for multiple task attachments

  1. New Tables
    - `task_attachments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `file_path` (text)
      - `file_name` (text)
      - `file_type` (text)
      - `file_size` (integer)
      - `created_at` (timestamptz)

  2. Changes
    - Drop attachment column from tasks table
    - Add task attachments table
    - Add RLS policies for task attachments

  3. Security
    - Enable RLS on task_attachments table
    - Add policies for creators to upload attachments
    - Add policies for anyone to view attachments
*/

-- Drop attachment column from tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS attachment;

-- Create task attachments table
CREATE TABLE task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies for task attachments
CREATE POLICY "Task attachments are viewable by everyone"
  ON task_attachments FOR SELECT
  USING (true);

CREATE POLICY "Task creators can insert attachments"
  ON task_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    task_id IN (
      SELECT id FROM tasks
      WHERE creator_id IN (
        SELECT id FROM profiles 
        WHERE pi_user_id = auth.uid()::text
      )
    )
  );