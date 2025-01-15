/*
  # Add delete_user function
  
  1. New Functions
    - `delete_user`: Deletes the currently authenticated user
  
  2. Security
    - Function is marked as SECURITY DEFINER to run with elevated privileges
    - Only authenticated users can execute this function
*/

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
BEGIN
  -- Get the ID of the currently authenticated user
  _user_id := auth.uid();
  
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete the user from auth.users
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_user TO authenticated;