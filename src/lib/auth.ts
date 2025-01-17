import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import axios from 'axios';
import './types/pi'; // Import Pi types

// Pi Network API client
const piApi = axios.create({
  baseURL: 'https://api.minepi.com/v2',
  timeout: 20000,
});

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPi = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!window.Pi) {
        throw new Error('Please use Pi Browser');
      }

      const authResult = await window.Pi.authenticate(
        ['username', 'payments'],
        () => {} // Empty callback since we don't handle incomplete payments
      );

      if (!authResult?.accessToken || !authResult?.user?.username) {
        throw new Error('Failed to authenticate with Pi Network');
      }

      // Verify user with Pi Platform API
      const { data: userData } = await piApi.get('/me', {
        headers: { 'Authorization': `Bearer ${authResult.accessToken}` }
      });

      if (!userData?.uid || userData.uid !== authResult.user.uid) {
        throw new Error('User verification failed');
      }

      // Create email from username (for Supabase auth)
      const email = `${authResult.user.username}@gigs.user`;
      const password = `GIGS_${authResult.user.uid}`;

      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        setUser(signInData.user);
        return;
      }

      // If sign in fails, create new account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: authResult.user.username,
            pi_uid: authResult.user.uid,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Failed to create account');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          pi_user_id: signUpData.user.id,
          username: authResult.user.username,
          rating: 0,
          completed_tasks: 0
        });

      if (profileError) {
        await supabase.auth.signOut();
        throw new Error('Failed to create profile');
      }

      setUser(signUpData.user);
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return {
    user,
    loading,
    error,
    signInWithPi,
    signOut,
  };
}