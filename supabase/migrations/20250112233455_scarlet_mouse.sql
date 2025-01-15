/*
  # Initial Schema Setup for Pi Network Marketplace

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `pi_user_id` (text, unique)
      - `username` (text)
      - `rating` (numeric)
      - `completed_tasks` (integer)
    - `tasks`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `payment_amount` (numeric)
      - `creator_id` (uuid, references profiles)
      - `executor_id` (uuid, references profiles)
      - `status` (enum: open, in_progress, completed, disputed)
    - `bids`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `bidder_id` (uuid, references profiles)
      - `amount` (numeric)
      - `status` (enum: pending, accepted, rejected)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create custom types
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'completed', 'disputed');
CREATE TYPE bid_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  pi_user_id text UNIQUE NOT NULL,
  username text NOT NULL,
  rating numeric DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  completed_tasks integer DEFAULT 0
);

-- Create tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  title text NOT NULL,
  description text NOT NULL,
  payment_amount numeric NOT NULL CHECK (payment_amount > 0),
  creator_id uuid REFERENCES profiles(id) NOT NULL,
  executor_id uuid REFERENCES profiles(id),
  status task_status DEFAULT 'open'
);

-- Create bids table
CREATE TABLE bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  task_id uuid REFERENCES tasks(id) NOT NULL,
  bidder_id uuid REFERENCES profiles(id) NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status bid_status DEFAULT 'pending'
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid()::text = pi_user_id)
  WITH CHECK (auth.uid()::text = pi_user_id);

-- Tasks policies
CREATE POLICY "Tasks are viewable by everyone"
  ON tasks FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (creator_id IN (SELECT id FROM profiles WHERE pi_user_id = auth.uid()::text));

CREATE POLICY "Task creators can update their tasks"
  ON tasks FOR UPDATE
  USING (creator_id IN (SELECT id FROM profiles WHERE pi_user_id = auth.uid()::text));

-- Bids policies
CREATE POLICY "Bids are viewable by everyone"
  ON bids FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create bids"
  ON bids FOR INSERT
  TO authenticated
  WITH CHECK (bidder_id IN (SELECT id FROM profiles WHERE pi_user_id = auth.uid()::text));

CREATE POLICY "Bid creators can update their bids"
  ON bids FOR UPDATE
  USING (bidder_id IN (SELECT id FROM profiles WHERE pi_user_id = auth.uid()::text));