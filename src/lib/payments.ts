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

  try {
    // First authenticate with Pi Network
    const authResult = await window.Pi.authenticate(
      ['payments'], 
      (payment: any) => {
        console.log('Incomplete payment found:', payment);
      }
    );

    if (!authResult?.accessToken) {
      throw new Error('Authentication failed');
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
  } catch (err) {
    paymentInProgress = false;
    console.error('Payment initialization error:', err);
    throw new Error('Failed to initialize payment. Please try again.');
  }
}

// For A2U payments, we'll use the Pi Backend SDK
export async function initiateA2UPayment(amount: number, userUid: string): Promise<PaymentResult> {
  try {
    // Create payment data
    const paymentData = {
      amount,
      memo: "Task payment release",
      metadata: { type: "task_payment_release", timestamp: Date.now() },
      uid: userUid
    };

    // Make API call to create A2U payment
    const { data: payment } = await platformAPIClient.post('/a2u-payments/create', paymentData);
    
    if (!payment?.paymentId || !payment?.txid) {
      throw new Error('Failed to create A2U payment');
    }

    return {
      status: "completed",
      paymentId: payment.paymentId,
      txid: payment.txid
    };
  } catch (err) {
    console.error('A2U payment error:', err);
    throw new Error('Failed to process payment to executor');
  }
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