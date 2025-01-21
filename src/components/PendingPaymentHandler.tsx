import { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { Button } from './ui/Button';
import platformAPIClient from '../lib/platformAPIClient';
import type { PiPayment } from '../lib/types/pi';

// Extend PiPayment with additional properties from API response
interface PendingPayment extends Omit<PiPayment, 'status'> {
  status: string; // Override status to match API response
  api_status?: string; // Additional status from API
}

export function PendingPaymentHandler({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);

  const checkPendingPayments = async () => {
    setLoading(true);
    setError(null);
    setPendingPayments([]); // Clear existing payments
    
    try {
      let foundPayments: PendingPayment[] = [];

      // First try to get incomplete payments from Pi SDK
      await new Promise<void>((resolve) => {
        window.Pi.authenticate(
          ['payments'], 
          async (payment: PiPayment) => {
            console.log('Found incomplete payment:', payment);
            try {
              const response = await platformAPIClient.get(`/payments/${payment.identifier}`);
              foundPayments.push({
                ...payment,
                ...response.data,
                status: response.data.status || payment.status
              });
            } catch (err) {
              console.error('Error fetching payment details:', err);
              foundPayments.push({
                ...payment,
                api_status: 'error'
              });
            }
            resolve();
          },
          (error: Error) => {
            console.error('Pi SDK error:', error);
            resolve();
          }
        );
      });

      // If no payments found in SDK, try to get from platform API
      if (foundPayments.length === 0) {
        try {
          const response = await platformAPIClient.get('/payments');
          const apiPayments = response.data.filter((p: PendingPayment) => 
            p.status === 'pending' || p.status === 'submitted'
          );
          if (apiPayments.length > 0) {
            console.log('Found pending payments from API:', apiPayments);
            foundPayments = [...foundPayments, ...apiPayments];
          }
        } catch (err) {
          console.error('Error fetching payments from API:', err);
        }
      }

      if (foundPayments.length === 0) {
        setError('No pending payments found. If you believe this is incorrect, please try again.');
      } else {
        setPendingPayments(foundPayments);
      }
    } catch (err) {
      console.error('Error checking pending payments:', err);
      setError('Failed to check pending payments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (payment: PendingPayment, action: 'complete' | 'cancel') => {
    setLoading(true);
    setError(null);

    try {
      const paymentId = payment.identifier;
      
      // First check current payment status
      const response = await platformAPIClient.get(`/payments/${paymentId}`);
      const currentStatus = response.data.status;

      if (currentStatus === 'completed') {
        console.log('Payment already completed:', paymentId);
        setPendingPayments(prev => prev.filter(p => p.identifier !== paymentId));
        onComplete();
        return;
      }

      if (currentStatus === 'cancelled' || currentStatus === 'expired') {
        console.log('Payment already cancelled/expired:', paymentId);
        setPendingPayments(prev => prev.filter(p => p.identifier !== paymentId));
        onComplete();
        return;
      }

      if (action === 'complete' && payment.transaction?.txid) {
        await platformAPIClient.post(`/payments/${paymentId}/complete`, { 
          txid: payment.transaction.txid 
        });
        console.log('Payment completed:', paymentId);
      } else {
        await platformAPIClient.post(`/payments/${paymentId}/cancel`);
        console.log('Payment cancelled:', paymentId);
      }

      setPendingPayments(prev => prev.filter(p => p.identifier !== paymentId));
      onComplete();
    } catch (err) {
      console.error('Error handling payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to handle payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <Button
        onClick={checkPendingPayments}
        isLoading={loading}
        variant="secondary"
        className="w-full"
      >
        Check Pending Payments
      </Button>

      {pendingPayments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-900">Pending Payments</h3>
          {pendingPayments.map((payment) => (
            <div
              key={payment.identifier}
              className="p-4 bg-gray-50 rounded-lg space-y-3"
            >
              <div className="text-sm space-y-1">
                <p className="font-medium">Payment ID: {payment.identifier}</p>
                <p className="text-gray-500">Amount: {payment.amount} π</p>
                <p className="text-gray-500">
                  Created: {new Date(payment.created_at).toLocaleString()}
                </p>
                <p className="text-gray-500">Status: {payment.status}</p>
                {payment.api_status && (
                  <p className="text-gray-500">API Status: {payment.api_status}</p>
                )}
                {payment.transaction?.txid && (
                  <p className="text-gray-500">
                    Transaction ID: {payment.transaction.txid}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {payment.transaction?.txid ? (
                  <Button
                    onClick={() => handlePayment(payment, 'complete')}
                    isLoading={loading}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Complete Payment
                  </Button>
                ) : (
                  <Button
                    onClick={() => handlePayment(payment, 'cancel')}
                    isLoading={loading}
                    variant="danger"
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel Payment
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}