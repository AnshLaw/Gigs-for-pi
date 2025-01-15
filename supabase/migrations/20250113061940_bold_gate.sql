-- Drop existing function if it exists
DROP FUNCTION IF EXISTS delete_user;

-- Create an improved delete_user function
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id text;
  _profile_id uuid;
BEGIN
  -- Get the ID of the currently authenticated user
  _user_id := auth.uid()::text;
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the profile ID
  SELECT id INTO _profile_id
  FROM profiles
  WHERE pi_user_id = _user_id;

  IF _profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Delete all bids by this user
  DELETE FROM bids WHERE bidder_id = _profile_id;

  -- Delete all messages by this user
  DELETE FROM messages WHERE sender_id = _profile_id;

  -- Delete all tasks by this user
  DELETE FROM tasks WHERE creator_id = _profile_id;

  -- Delete the profile
  DELETE FROM profiles WHERE id = _profile_id;

  -- Delete the user from auth.users
  DELETE FROM auth.users WHERE id = _user_id::uuid;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user TO authenticated;