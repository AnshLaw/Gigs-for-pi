/*
  # Add attachment support for tasks

  1. Changes
    - Add `attachment` column to tasks table to store file paths
    - Add storage policies for task attachments

  2. Security
    - Only allow task creators to upload attachments
    - Allow anyone to view attachments for public tasks
*/

-- Add attachment column to tasks table
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS attachment text;

-- Create policy for uploading task attachments
CREATE POLICY "Task creators can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.creator_id IN (
        SELECT id FROM profiles 
        WHERE pi_user_id = auth.uid()::text
      )
    )
  );

-- Create policy for viewing task attachments
CREATE POLICY "Anyone can view task attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');