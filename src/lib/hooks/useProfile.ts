import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { Profile } from '../types';

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);

        // Get user's email for username
        const { data: { user } } = await supabase.auth.getUser();
        const username = user?.email ? user.email.split('@')[0] : 'user';

        // First try to get existing profile
        const { data: profiles, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('pi_user_id', userId);

        if (!mounted) return;

        if (fetchError) throw fetchError;

        if (!profiles || profiles.length === 0) {
          // Profile doesn't exist, create one
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              pi_user_id: userId,
              username,
              rating: 0,
              completed_tasks: 0
            })
            .select()
            .single();

          if (!mounted) return;

          if (createError) throw createError;
          setProfile(newProfile);
        } else {
          setProfile(profiles[0]);
        }
      } catch (err) {
        if (!mounted) return;
        console.error('Error fetching/creating profile:', err);
        setError('Failed to load profile. Please try again.');
        setProfile(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [userId]);

  return { profile, loading, error };
}