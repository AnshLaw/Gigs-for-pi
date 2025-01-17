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
      }>;
      createPayment: (payment: {
        amount: number,
        memo: string,
        metadata: Record<string, any>
      }) => Promise<{
        identifier: string;
        status: {
          developer_approved: boolean;
          transaction_verified: boolean;
          developer_completed: boolean;
          cancelled: boolean;
          user_cancelled: boolean;
        };
      }>;
      completePayment: (paymentId: string, txid: string) => Promise<void>;
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
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPi = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!window.Pi) {
        throw new Error('Pi Network SDK not found');
      }

      // Authenticate with Pi Network
      const auth = await window.Pi.authenticate(
        ['username', 'payments'],
        () => {}
      );

      const { user: piUser } = auth;

      if (!piUser?.username) {
        throw new Error('Failed to get Pi username');
      }

      // Simple email format for auth
      const email = `${piUser.username}@gigs.user`;
      const password = `PI_${piUser.uid}`;

      // Try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      // If sign in succeeds, we're done
      if (!signInError) {
        setUser(signInData.user);
        return { error: null };
      }

      // If sign in fails, create a new account
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

      // Handle sign up errors
      if (signUpError) {
        // If user exists, force sign in
        if (signUpError.message.includes('User already registered')) {
          const { data: forceSignInData, error: forceSignInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (forceSignInError) {
            throw new Error('Unable to sign in. Please try again.');
          }

          setUser(forceSignInData.user);
          return { error: null };
        }

        throw signUpError;
      }

      // If we have a new user, create their profile
      if (signUpData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            pi_user_id: signUpData.user.id,
            username: piUser.username,
            rating: 0,
            completed_tasks: 0,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          await supabase.auth.signOut();
          throw new Error('Failed to create profile');
        }

        setUser(signUpData.user);
        return { error: null };
      }

      throw new Error('Failed to authenticate');
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