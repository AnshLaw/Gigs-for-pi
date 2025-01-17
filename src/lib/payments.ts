import { supabase } from './supabase';
import axios from 'axios';

// Pi Network API configuration
const piApi = axios.create({
  baseURL: 'https://gigsforpi.live',
  timeout: 20000,
  headers: {
    'Authorization': `Key ${import.meta.env.VITE_PI_API_KEY}`
  }
});

// Test payment amount for app setup
const TEST_PAYMENT_AMOUNT = 0.1;

export async function createTestPayment() {
  return createPayment(
    TEST_PAYMENT_AMOUNT,
    'App Setup Test Payment',
    { type: 'test_payment' }
  );
}

export async function createPayment(amount: number, memo: string, metadata: Record<string, any>) {
  try {
    if (!window.Pi) {
      throw new Error('Please use Pi Browser');
    }

    if (!amount || amount <= 0) {
      throw new Error('Invalid payment amount');
    }

    // Get current user's profile
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('pi_user_id', auth.user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Create payment with Pi SDK
    const payment = await window.Pi.createPayment(
      {
        amount,
        memo,
        metadata: { ...metadata, profileId: profile.id }
      },
      {
        // Called when payment is ready for approval
        onReadyForServerApproval: async (paymentId: string) => {
          console.log('Payment ready for approval:', paymentId);
          try {
            // Call Pi Network API to approve payment
            await piApi.post(`/v2/payments/${paymentId}/approve`);
          } catch (err) {
            console.error('Error approving payment:', err);
            throw err;
          }
        },

        // Called when payment is ready for completion
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          console.log('Payment ready for completion:', paymentId, txid);
          try {
            // Call Pi Network API to complete payment
            await piApi.post(`/v2/payments/${paymentId}/complete`, { txid });

            // Update local database with transaction info
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                wallet_address: txid,
                last_payment_id: paymentId
              })
              .eq('id', profile.id);

            if (updateError) throw updateError;
          } catch (err) {
            console.error('Error completing payment:', err);
            throw err;
          }
        },

        // Called when user cancels payment
        onCancel: async (paymentId: string) => {
          console.log('Payment cancelled:', paymentId);
          try {
            // Update local database to reflect cancellation
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ last_payment_id: null })
              .eq('id', profile.id);

            if (updateError) throw updateError;
          } catch (err) {
            console.error('Error handling payment cancellation:', err);
            throw err;
          }
        },

        // Called when there's a payment error
        onError: (error: Error, payment?: any) => {
          console.error('Payment error:', error, payment);
          throw error;
        }
      }
    );

    return { success: true, paymentId: payment.identifier };
  } catch (err) {
    console.error('Payment error:', err);
    throw err;
  }
}

// Function to handle incomplete payments
export async function handleIncompletePayment(payment: any) {
  try {
    const { identifier: paymentId, transaction } = payment;
    const txid = transaction?.txid;
    const txURL = transaction?._link;

    if (!txid || !txURL) {
      throw new Error('Invalid transaction data');
    }

    // Verify transaction on Pi blockchain
    const { data: txData } = await axios.get(txURL);
    
    // Verify payment ID matches
    if (txData.memo !== paymentId) {
      throw new Error('Payment ID mismatch');
    }

    // Complete the payment
    await piApi.post(`/v2/payments/${paymentId}/complete`, { txid });

    return { success: true };
  } catch (err) {
    console.error('Error handling incomplete payment:', err);
    throw err;
  }
}

// Function to check payment status
export async function checkPaymentStatus(paymentId: string) {
  try {
    const { data: payment } = await piApi.get(`/v2/payments/${paymentId}`);
    return payment;
  } catch (err) {
    console.error('Error checking payment status:', err);
    throw err;
  }
}