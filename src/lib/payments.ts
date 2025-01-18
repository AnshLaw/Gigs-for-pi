import platformAPIClient from './platformAPIClient';
import type { PaymentData } from '../types/pi';

interface PaymentResult {
  status: string;
  paymentId: string;
  txid: string;
}

export async function initiatePayment(amount: number): Promise<PaymentResult> {
  if (!window.Pi) {
    throw new Error('Please use Pi Browser');
  }

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
          const response = await platformAPIClient.get(`/payments/${paymentId}`);
          console.log('Payment status:', response.data);
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
    console.log('Completing payment:', { paymentId, txid });
    await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
    console.log('Payment completed successfully');
    return { status: "completed", paymentId, txid };
  } catch (err) {
    console.error("Payment completion failed:", err);
    throw new Error('Payment completion failed. Please try again.');
  }
}