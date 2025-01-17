// import { supabase } from './supabase';
import axios from 'axios';
import type { PaymentData, PaymentCallbacks } from '../types/pi'; // Updated import path
import '../types/pi'; // Updated import path

// Pi Platform API client
const piApi = axios.create({
  baseURL: 'https://api.minepi.com/v2',
  timeout: 20000,
});

export async function initiatePayment(amount: number = 1) {
  if (!window.Pi) {
    throw new Error('Please use Pi Browser');
  }

  return new Promise((resolve, reject) => {
    const paymentData: PaymentData = {
      amount,
      memo: "Test payment",
      metadata: { timestamp: Date.now() }
    };

    const callbacks: PaymentCallbacks = {
      onReadyForServerApproval: async (paymentId: string) => {
        try {
          // Send payment ID to your server for approval
          const response = await axios.post('/api/payments/approve', { paymentId });
          console.log('Payment approved:', response.data);
        } catch (err) {
          console.error('Error approving payment:', err);
          reject(err);
        }
      },

      onReadyForServerCompletion: async (paymentId: string, txid: string) => {
        try {
          // Send transaction ID to your server to complete the payment
          const response = await axios.post('/api/payments/complete', { 
            paymentId,
            txid
          });
          console.log('Payment completed:', response.data);
          resolve({ paymentId, txid });
        } catch (err) {
          console.error('Error completing payment:', err);
          reject(err);
        }
      },

      onCancel: (paymentId: string) => {
        console.log('Payment cancelled:', paymentId);
        reject(new Error('Payment cancelled'));
      },

      onError: (error: Error, payment?: any) => {
        console.error('Payment error:', error, payment);
        reject(error);
      }
    };

    window.Pi.createPayment(paymentData, callbacks);
  });
}

export async function handleIncompletePayment(payment: any) {
  try {
    // Send incomplete payment to your server
    const response = await axios.post('/api/payments/incomplete', { payment });
    console.log('Handled incomplete payment:', response.data);
    return response.data;
  } catch (err) {
    console.error('Error handling incomplete payment:', err);
    throw err;
  }
}