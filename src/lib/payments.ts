import platformAPIClient from './platformAPIClient';
import type { PaymentData } from '../types/pi';

interface PaymentResult {
  status: string;
  paymentId: string;
  txid: string;
}

async function handleIncompletePayment(payment: any): Promise<void> {
  try {
    const paymentId = payment.identifier;
    const txid = payment.transaction?.txid;
    
    if (!paymentId) {
      console.log('No payment ID found for incomplete payment');
      return;
    }

    // Get payment status from Pi platform
    const response = await platformAPIClient.get(`/payments/${paymentId}`);
    const paymentStatus = response.data.status;

    if (txid && paymentStatus === 'completed') {
      console.log('Payment already completed:', paymentId);
      return;
    }

    if (paymentStatus === 'cancelled' || paymentStatus === 'expired') {
      console.log('Payment already cancelled/expired:', paymentId);
      return;
    }

    if (txid) {
      // Complete the payment if there's a transaction ID
      await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
      console.log('Completed incomplete payment:', paymentId);
    } else {
      // Cancel the payment if there's no transaction
      await platformAPIClient.post(`/payments/${paymentId}/cancel`);
      console.log('Cancelled incomplete payment:', paymentId);
    }
  } catch (err) {
    console.error('Error handling incomplete payment:', err);
    // Don't throw, just log the error and continue
    console.log('Continuing despite incomplete payment error');
  }
}

async function clearIncompletePayments(): Promise<void> {
  return new Promise((resolve, _reject) => {
    try {
      window.Pi.authenticate(['payments'], async (auth: any) => {
        if (auth.payments && auth.payments.length > 0) {
          console.log('Found incomplete payments:', auth.payments);
          for (const payment of auth.payments) {
            await handleIncompletePayment(payment);
          }
        }
        resolve();
      });
    } catch (err) {
      console.error('Error clearing incomplete payments:', err);
      resolve(); // Resolve anyway to continue with new payment
    }
  });
}

export async function initiatePayment(amount: number): Promise<PaymentResult> {
  if (!window.Pi) {
    throw new Error('Please use Pi Browser');
  }

  // First clear any incomplete payments
  await clearIncompletePayments();

  return new Promise((resolve, reject) => {
    const paymentData: PaymentData = {
      amount,
      memo: "Task payment escrow",
      metadata: { type: "task_payment", timestamp: Date.now() }
    };

    const callbacks = {
      onReadyForServerApproval: async function(paymentId: string) {
        try {
          console.log('Payment ready for approval:', paymentId);
          // First verify the payment
          const response = await platformAPIClient.get(`/payments/${paymentId}`);
          const payment = response.data;
          
          // Verify payment details
          if (payment.amount !== amount) {
            throw new Error('Payment amount mismatch');
          }
          
          // Approve the payment
          await platformAPIClient.post(`/payments/${paymentId}/approve`);
          console.log('Payment approved');
        } catch (err) {
          console.error("Server approval failed:", err);
          reject(new Error('Payment approval failed. Please try again.'));
        }
      },

      onReadyForServerCompletion: async function(paymentId: string, txid: string) {
        try {
          console.log('Payment ready for completion:', { paymentId, txid });
          
          // Complete the payment
          await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
          console.log('Payment completed successfully');
          
          resolve({ 
            status: "completed", 
            paymentId, 
            txid 
          });
        } catch (err) {
          console.error("Server completion failed:", err);
          reject(new Error('Payment completion failed. Please try again.'));
        }
      },

      onCancel: function(paymentId: string) {
        console.log('Payment cancelled:', paymentId);
        reject(new Error('Payment cancelled by user'));
      },

      onError: function(error: Error, payment?: any) {
        console.error("Payment error:", error, payment);
        reject(new Error(`Payment failed: ${error.message}`));
      }
    };

    try {
      console.log('Creating payment with data:', paymentData);
      window.Pi.createPayment(paymentData, callbacks);
    } catch (err) {
      console.error('Error creating payment:', err);
      reject(new Error('Failed to create payment. Please try again.'));
    }
  });
}

export async function completePayment(paymentId: string, txid: string): Promise<PaymentResult> {
  try {
    // Complete the payment
    await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
    console.log('Payment completed successfully');
    
    return { 
      status: "completed", 
      paymentId, 
      txid 
    };
  } catch (err) {
    console.error("Payment completion failed:", err);
    throw new Error('Payment completion failed. Please try again.');
  }
}