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
          walletAddress?: string;
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

      // Authenticate with Pi Network - now including wallet scope
      console.log('Starting Pi authentication...');
      const auth = await window.Pi.authenticate(
        ['username', 'payments', 'wallet_address'],
        () => {}
      ).catch(err => {
        console.error('Pi authenticate error:', err);
        throw new Error('Failed to authenticate with Pi Network');
      });

      console.log('Pi auth response:', auth);
      const { user: piUser } = auth;

      if (!piUser?.username) {
        throw new Error('Failed to get Pi username');
      }

      // Always use gigs.user domain
      const userEmail = `${piUser.username}@gigs.user`;
      const userPassword = `PI_${piUser.uid}`;

      // Try to sign in
      console.log('Attempting sign in...');
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      });

      if (!signInError) {
        console.log('Sign in successful');
        // Update wallet address if it has changed
        if (piUser.walletAddress) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ wallet_address: piUser.walletAddress })
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
        email: userEmail,
        password: userPassword,
        options: {
          data: {
            username: piUser.username,
            pi_uid: piUser.uid,
          },
        },
      });

      if (signUpError) {
        console.error('Sign up error:', signUpError);
        throw new Error('Unable to authenticate. Please try again.');
      }

      if (!signUpData.user) {
        throw new Error('Failed to create account');
      }

      console.log('Creating profile...');
      // Create profile for new user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          pi_user_id: signUpData.user.id,
          username: piUser.username,
          wallet_address: piUser.walletAddress,
          rating: 0,
          completed_tasks: 0,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // If profile creation fails, clean up by deleting the user
        await supabase.auth.signOut();
        throw new Error('Failed to create profile');
      }

      console.log('Account created successfully');
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