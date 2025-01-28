import platformAPIClient from './platformAPIClient';
import type { PaymentData } from '../types/pi';

interface PaymentResult {
  status: string;
  paymentId: string;
  txid: string;
}

let paymentInProgress = false;

export async function initiatePayment(amount: number): Promise<PaymentResult> {
  if (!window.Pi) {
    throw new Error('Please use Pi Browser');
  }

  if (paymentInProgress) {
    throw new Error('A payment is already in progress');
  }

  paymentInProgress = true;

  return new Promise((resolve, reject) => {
    const paymentData: PaymentData = {
      amount,
      memo: "Task payment escrow",
      metadata: { type: "task_payment", timestamp: Date.now() }
    };

    const timeoutId = setTimeout(() => {
      paymentInProgress = false;
      reject(new Error('Payment timed out. Please try again.'));
    }, 60000); // 1 minute timeout

    const callbacks = {
      onReadyForServerApproval: async function(paymentId: string) {
        try {
          console.log('Payment ready for approval:', paymentId);
          const response = await platformAPIClient.get(`/payments/${paymentId}`);
          const payment = response.data;
          
          if (payment.amount !== amount) {
            throw new Error('Payment amount mismatch');
          }
          
          await platformAPIClient.post(`/payments/${paymentId}/approve`);
          console.log('Payment approved');
        } catch (err) {
          console.error("Server approval failed:", err);
          clearTimeout(timeoutId);
          paymentInProgress = false;
          reject(new Error('Payment approval failed. Please try again.'));
        }
      },

      onReadyForServerCompletion: async function(paymentId: string, txid: string) {
        try {
          clearTimeout(timeoutId);
          console.log('Payment ready for completion:', { paymentId, txid });
          
          await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
          console.log('Payment completed successfully');
          
          paymentInProgress = false;
          resolve({ 
            status: "completed", 
            paymentId, 
            txid 
          });
        } catch (err) {
          console.error("Server completion failed:", err);
          paymentInProgress = false;
          reject(new Error('Payment completion failed. Please try again.'));
        }
      },

      onCancel: function(paymentId: string) {
        console.log('Payment cancelled:', paymentId);
        clearTimeout(timeoutId);
        paymentInProgress = false;
        reject(new Error('Payment cancelled by user'));
      },

      onError: function(error: Error, payment?: any) {
        console.error("Payment error:", error, payment);
        clearTimeout(timeoutId);
        paymentInProgress = false;
        reject(new Error(`Payment failed: ${error.message}`));
      }
    };

    try {
      console.log('Creating payment with data:', paymentData);
      window.Pi.createPayment(paymentData, callbacks);
    } catch (err) {
      console.error('Error creating payment:', err);
      clearTimeout(timeoutId);
      paymentInProgress = false;
      reject(new Error('Failed to create payment. Please try again.'));
    }
  });
}

export async function completePayment(paymentId: string, txid: string): Promise<PaymentResult> {
  try {
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

// New function to handle A2U payments
export async function sendPaymentToUser(amount: number, userUid: string, memo: string): Promise<PaymentResult> {
  try {
    // Create A2U payment
    const createResponse = await platformAPIClient.post('/a2u-payments/create', {
      amount,
      memo,
      metadata: { type: 'escrow_release', timestamp: Date.now() },
      uid: userUid
    });

    const { payment_id } = createResponse.data;

    // Submit payment to blockchain
    const submitResponse = await platformAPIClient.post(`/a2u-payments/${payment_id}/submit`);
    const { txid } = submitResponse.data;

    // Complete the payment
    const completeResponse = await platformAPIClient.post(`/a2u-payments/${payment_id}/complete`, { txid });
    const payment = completeResponse.data;

    if (payment.status.developer_completed && payment.transaction?.verified) {
      return {
        status: 'completed',
        paymentId: payment_id,
        txid
      };
    }

    throw new Error('Payment verification failed');
  } catch (err) {
    console.error('A2U payment error:', err);
    throw new Error('Failed to send payment to user');
  }
}