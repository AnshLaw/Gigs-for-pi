/*
  # Fix profiles table RLS policies

  1. Changes
    - Update profiles RLS policies to allow authenticated users to:
      - Insert their own profile
      - Select profiles
      - Update their own profile
  
  2. Security
    - Ensures users can only create/update their own profile
    - Maintains public read access for all profiles
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = pi_user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = pi_user_id)
  WITH CHECK (auth.uid()::text = pi_user_id);