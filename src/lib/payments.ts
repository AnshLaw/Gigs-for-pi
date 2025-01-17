import { supabase } from './supabase';

export async function createTestPayment() {
  try {
    if (!window.Pi) {
      throw new Error('Please use Pi Browser');
    }

    return new Promise((resolve, reject) => {
      // Create a small test payment
      window.Pi.createPayment({
        amount: 0.1, // Small amount for testing
        memo: "Test payment to complete app setup",
        metadata: { type: "app_setup_test" }
      }, {
        onReadyForServerApproval: async (paymentId) => {
          console.log('Ready for server approval:', paymentId);
          // In a real app, you would make a server call here
          // For the test payment, we'll simulate success
          try {
            await window.Pi.openPaymentDialog(paymentId);
          } catch (err) {
            console.error('Error opening payment dialog:', err);
            reject(err);
          }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          console.log('Payment completed:', { paymentId, txid });
          try {
            // Update user's profile with the wallet address from the payment
            const { data: auth } = await supabase.auth.getUser();
            if (!auth.user) throw new Error('Not authenticated');

            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('pi_user_id', auth.user.id)
              .single();

            if (!profile) throw new Error('Profile not found');

            // Extract wallet address from transaction
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ wallet_address: txid }) // Using txid as wallet for demo
              .eq('id', profile.id);

            if (updateError) throw updateError;

            resolve({ paymentId, txid });
          } catch (err) {
            console.error('Error updating profile:', err);
            reject(err);
          }
        },
        onCancel: (paymentId) => {
          console.log('Payment cancelled:', paymentId);
          reject(new Error('Payment was cancelled'));
        },
        onError: (error, payment) => {
          console.error('Payment error:', error, payment);
          reject(error);
        }
      }).catch(reject);
    });
  } catch (err) {
    console.error('Payment error:', err);
    throw err;
  }
}