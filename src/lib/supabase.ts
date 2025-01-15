import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

// These will be provided by the "Connect to Supabase" button
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);