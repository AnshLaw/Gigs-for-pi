import type { PaymentData, PaymentCallbacks } from '../types/pi';

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

    const callbacks: PaymentCallbacks = {
      onReadyForServerApproval: function(paymentId) {
        console.log("onReadyForServerApproval", paymentId);
        resolve({ status: "waiting_for_completion", paymentId });
      },
      onReadyForServerCompletion: function(paymentId, txid) {
        console.log("onReadyForServerCompletion", paymentId, txid);
        resolve({ status: "completed", paymentId, txid });
      },
      onCancel: function(paymentId) {
        console.log("onCancel", paymentId);
        reject(new Error('Payment cancelled'));
      },
      onError: function(error, payment) {
        console.error("onError", error, payment);
        if (error.message === "User cancelled consent") {
          // Handle consent cancellation gracefully
          reject(new Error('Please approve the payment to continue'));
        } else {
          reject(error);
        }
      }
    };

    window.Pi.createPayment(paymentData, callbacks);
  });
}