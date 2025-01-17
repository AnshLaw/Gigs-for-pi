import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

declare global {
  interface Window {
    Pi: {
      init: (config: { version: string, sandbox?: boolean }) => void;
      authenticate: (scopes: string[], onIncompletePaymentFound: (payment: any) => void) => Promise<{
        accessToken: string;
        user: {
          uid: string;
          username: string;
        };
        credentials?: Array<{
          type: string;
          address: string;
        }>;
      }>;
    };
  }
}

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

      // Check if Pi SDK is available
      if (!window.Pi) {
        throw new Error('Please use Pi Browser');
      }

      // Authenticate with Pi Network
      const auth = await window.Pi.authenticate(['username', 'wallet_address'], () => {
        // Handle incomplete payments if needed
        console.log('Checking for incomplete payments...');
      });

      console.log('Pi auth response:', auth); // Debug log

      if (!auth?.user?.username) {
        throw new Error('Failed to get username from Pi Network');
      }

      // Create email from username
      const email = `${auth.user.username}@gigs.user`;
      const password = `GIGS_${auth.user.uid}`;

      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // Get wallet address if available
      const walletAddress = auth.credentials?.find(
        cred => cred.type === 'wallet_address'
      )?.address;

      if (!signInError) {
        // If wallet address is available, update it
        if (walletAddress) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ wallet_address: walletAddress })
            .eq('pi_user_id', signInData.user.id);

          if (updateError) {
            console.error('Failed to update wallet address:', updateError);
          }
        }

        setUser(signInData.user);
        return;
      }

      // If sign in fails, create new account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: auth.user.username,
            pi_uid: auth.user.uid,
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
          username: auth.user.username,
          wallet_address: walletAddress, // May be undefined, which is fine
          rating: 0,
          completed_tasks: 0,
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