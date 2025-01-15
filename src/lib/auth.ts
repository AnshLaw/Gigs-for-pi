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
      console.log('Starting Pi authentication...');
      const auth = await window.Pi.authenticate(['username', 'payments'], () => {
        console.log('Incomplete payment found!');
      }).catch(err => {
        console.error('Pi authenticate error:', err);
        throw new Error('Failed to authenticate with Pi Network');
      });
      
      console.log('Pi auth response:', auth);
      const { accessToken, user: piUser } = auth;

      if (!piUser || !piUser.username) {
        throw new Error('Failed to authenticate with Pi Network');
      }

      // For sandbox, we'll use a consistent password format
      const sandboxPassword = `SANDBOX_${piUser.uid}_${accessToken.slice(-8)}`;

      console.log('Attempting Supabase sign in...');
      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: `${piUser.username}@pi-sandbox.user`,
        password: sandboxPassword,
      });

      if (!signInError) {
        console.log('Signed in successfully');
        setUser(signInData.user);
        return { error: null };
      }

      // If user doesn't exist, create one
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('User not found, creating new account...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: `${piUser.username}@pi-sandbox.user`,
          password: sandboxPassword,
          options: {
            data: {
              pi_uid: piUser.uid,
              username: piUser.username,
            },
          },
        });

        if (signUpError) {
          console.error('Sign up error:', signUpError);
          throw signUpError;
        }

        if (!signUpData.user) {
          throw new Error('Failed to create user account');
        }

        console.log('Creating profile...');
        // Create profile
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
          // If profile creation fails, delete the user
          await supabase.auth.signOut();
          throw new Error('Failed to create profile');
        }

        console.log('Account created successfully');
        setUser(signUpData.user);
        return { error: null };
      }

      throw signInError;
    } catch (err) {
      console.error('Auth error:', err);
      setError(err instanceof Error ? err.message : 'Failed to authenticate with Pi Network');
      return { error: err instanceof Error ? err : new Error('Authentication failed') };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
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