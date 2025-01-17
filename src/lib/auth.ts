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
          credentials?: Array<{
            type: string;
            address: string;
          }>;
        };
      }>;
    };
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPi = async () => {
    try {
      setError(null);
      setLoading(true);

      // Check if Pi SDK is available
      if (typeof window.Pi === 'undefined') {
        throw new Error('Pi Network SDK not found. Please ensure you are using the Pi Browser.');
      }

      // Initialize Pi SDK
      try {
        window.Pi.init({ version: "2.0", sandbox: true });
      } catch (initError) {
        console.error('Pi SDK init error:', initError);
        throw new Error('Failed to initialize Pi Network SDK');
      }

      // Authenticate with Pi Network
      console.log('Starting Pi authentication...');
      const auth = await window.Pi.authenticate(
        ['username', 'payments', 'wallet_address'],
        () => console.log('Incomplete payment found')
      ).catch(authError => {
        console.error('Pi authenticate error:', authError);
        throw new Error('Failed to authenticate with Pi Network');
      });

      if (!auth?.user) {
        throw new Error('No user data received from Pi Network');
      }

      const { user: piUser } = auth;
      console.log('Pi auth successful:', piUser);

      // Find the wallet credential
      let walletAddress = null;
      if (piUser.credentials && Array.isArray(piUser.credentials)) {
        const walletCred = piUser.credentials.find(cred => cred.type === 'wallet_address');
        if (walletCred) {
          walletAddress = walletCred.address;
        }
      }

      console.log('Wallet address:', walletAddress);

      // Create credentials
      const email = `${piUser.username}@gigs.user`;
      const password = `GIGS_${piUser.uid}`;

      // Try to sign in first
      console.log('Attempting to sign in...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        console.log('Sign in successful');
        
        // Update wallet address if available
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
        return { error: null };
      }

      // If sign in fails, create new account
      console.log('Sign in failed, creating new account...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: piUser.username,
            pi_uid: piUser.uid,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Failed to create account');

      // Create profile
      console.log('Creating profile...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          pi_user_id: signUpData.user.id,
          username: piUser.username,
          wallet_address: walletAddress,
          rating: 0,
          completed_tasks: 0,
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        // Clean up the created auth user if profile creation fails
        await supabase.auth.signOut();
        throw new Error('Failed to create profile');
      }

      setUser(signUpData.user);
      return { error: null };
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Authentication failed');
      return { error: err instanceof Error ? err : new Error('Authentication failed') };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      return { error: null };
    } catch (err) {
      console.error('Sign out error:', err);
      return { error: err instanceof Error ? err : new Error('Failed to sign out') };
    }
  };

  return {
    user,
    loading,
    error,
    signInWithPi,
    signOut,
  };
}