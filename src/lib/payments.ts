import platformAPIClient from './platformAPIClient';
import type { PaymentData } from '../types/pi';

export async function initiatePayment(amount: number = 1) {
  if (!window.Pi) {
    throw new Error('Please use Pi Browser');
  }

  return new Promise((resolve, reject) => {
    const paymentData: PaymentData = {
      amount,
      memo: "Test payment to app",
      metadata: { type: "test_payment", timestamp: Date.now() }
    };

    const callbacks = {
      onReadyForServerApproval: async function(paymentId: string) {
        console.log("Payment ready for approval", paymentId);
        try {
          // Get payment details from Pi Platform API
          const { data: payment } = await platformAPIClient.get(`/payments/${paymentId}`);
          console.log("Payment details:", payment);

          // Approve the payment using Pi Platform API
          await platformAPIClient.post(`/payments/${paymentId}/approve`);
          console.log("Payment approved");
        } catch (err) {
          console.error("Server approval failed:", err);
          reject(err);
        }
      },

      onReadyForServerCompletion: async function(paymentId: string, txid: string) {
        console.log("Payment ready for completion", paymentId, txid);
        try {
          // Complete the payment using Pi Platform API
          await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
          resolve({ status: "completed", paymentId, txid });
        } catch (err) {
          console.error("Server completion failed:", err);
          reject(err);
        }
      },

      onCancel: async function(paymentId: string) {
        console.log("Payment cancelled", paymentId);
        try {
          // Handle cancelled payment
          const { data: payment } = await platformAPIClient.get(`/payments/${paymentId}`);
          console.log("Cancelled payment details:", payment);
          reject(new Error('Payment cancelled by user'));
        } catch (err) {
          console.error("Failed to handle cancelled payment:", err);
          reject(err);
        }
      },

      onError: async function(error: Error, payment: any) {
        console.error("Payment error", error, payment);
        if (error.message === "User cancelled consent") {
          // Handle user consent cancellation
          reject(new Error('Please approve the payment to continue'));
        } else {
          // Handle other errors
          try {
            if (payment?.identifier) {
              const { data: paymentDetails } = await platformAPIClient.get(`/payments/${payment.identifier}`);
              console.error("Error payment details:", paymentDetails);
            }
          } catch (err) {
            console.error("Failed to fetch error payment details:", err);
          }
          reject(error);
        }
      }
    };

    window.Pi.createPayment(paymentData, callbacks);
  });
}