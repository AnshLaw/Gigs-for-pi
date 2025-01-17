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
          credentials: Array<{
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

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

      // Initialize Pi SDK
      window.Pi.init({ version: "2.0", sandbox: true });

      // Authenticate with Pi Network
      const auth = await window.Pi.authenticate(['username', 'wallet_address'], () => {});
      
      if (!auth?.user) {
        throw new Error('Authentication failed');
      }

      const { user: piUser } = auth;
      const walletAddress = piUser.credentials?.find(cred => cred.type === 'wallet_address')?.address;

      // Create credentials
      const email = `${piUser.username}@gigs.user`;
      const password = `GIGS_${piUser.uid}`;

      // Try to sign in
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
            username: piUser.username,
            pi_uid: piUser.uid,
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
          username: piUser.username,
          wallet_address: walletAddress,
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