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
          await platformAPIClient.get(`/payments/${paymentId}`);
          await platformAPIClient.post(`/payments/${paymentId}/approve`);
        } catch (err) {
          console.error("Server approval failed:", err);
          reject(err);
        }
      },

      onReadyForServerCompletion: async function(paymentId: string, txid: string) {
        try {
          await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
          resolve({ status: "completed", paymentId, txid });
        } catch (err) {
          console.error("Server completion failed:", err);
          reject(err);
        }
      },

      onCancel: function() {
        reject(new Error('Payment cancelled by user'));
      },

      onError: function(error: Error) {
        console.error("Payment error:", error);
        reject(error);
      }
    };

    window.Pi.createPayment(paymentData, callbacks);
  });
}

export async function completePayment(paymentId: string, txid: string): Promise<PaymentResult> {
  try {
    await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
    return { status: "completed", paymentId, txid };
  } catch (err) {
    console.error("Payment completion failed:", err);
    throw err;
  }
}