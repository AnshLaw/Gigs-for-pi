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

      // Initialize Pi SDK
      window.Pi.init({ version: "2.0", sandbox: true });

      // Authenticate with Pi Network
      console.log('Starting Pi authentication...');
      const auth = await window.Pi.authenticate(
        ['username', 'payments', 'wallet_address'],
        () => console.log('Incomplete payment found!')
      ).catch(err => {
        console.error('Pi authenticate error:', err);
        throw new Error('Failed to authenticate with Pi Network');
      });
      
      console.log('Pi auth response:', auth);
      const { accessToken, user: piUser } = auth;

      if (!piUser || !piUser.username) {
        throw new Error('Failed to authenticate with Pi Network');
      }

      // Format username as a valid email
      const formattedEmail = `${piUser.username}@gigs.user`;

      // Generate a deterministic password based on Pi user data
      const password = `PI_${piUser.uid}_${accessToken.slice(-8)}`;

      // Try to sign in first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: formattedEmail,
        password,
      });

      if (!signInError) {
        console.log('Signed in successfully');
        setUser(signInData.user);
        return { error: null };
      }

      // If sign in fails, try to sign up
      console.log('Sign in failed, attempting sign up...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formattedEmail,
        password,
        options: {
          data: {
            pi_uid: piUser.uid,
            username: piUser.username,
          },
        },
      });

      if (signUpError) {
        // If user already exists but sign in failed, something is wrong
        if (signUpError.message?.includes('User already registered')) {
          throw new Error('Authentication failed. Please try again.');
        }
        throw signUpError;
      }

      if (!signUpData.user) {
        throw new Error('Failed to create user account');
      }

      // Create profile for new user
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

      console.log('Account created successfully');
      setUser(signUpData.user);
      return { error: null };
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