import { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
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
  const [manualPaymentId, setManualPaymentId] = useState('');
  const [manualTxid, setManualTxid] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const checkPendingPayments = async () => {
    setLoading(true);
    setError(null);
    setPendingPayments([]); // Clear existing payments
    
    try {
      let foundPayments: PendingPayment[] = [];

      // First try to get incomplete payments from Pi SDK
      try {
        const authResult = await window.Pi.authenticate(['payments'], () => {});
        console.log('Auth result:', authResult);

        if (authResult.user.payments?.length) {
          for (const payment of authResult.user.payments) {
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
          }
        }
      } catch (err) {
        console.error('Pi SDK error:', err);
      }

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
        setError('No pending payments found automatically. You can try completing the payment manually.');
      } else {
        console.log('Setting pending payments:', foundPayments);
        setPendingPayments(foundPayments);
      }
    } catch (err) {
      console.error('Error checking pending payments:', err);
      setError('Failed to check pending payments. Please try again or use manual completion.');
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

  const handleManualComplete = async () => {
    if (!manualPaymentId || !manualTxid) {
      setError('Please provide both Payment ID and Transaction ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First check if payment exists and its status
      const response = await platformAPIClient.get(`/payments/${manualPaymentId}`);
      const currentStatus = response.data.status;

      if (currentStatus === 'completed') {
        console.log('Payment already completed:', manualPaymentId);
        onComplete();
        return;
      }

      // Complete the payment
      await platformAPIClient.post(`/payments/${manualPaymentId}/complete`, {
        txid: manualTxid
      });

      console.log('Payment completed manually:', manualPaymentId);
      setManualPaymentId('');
      setManualTxid('');
      setShowManualInput(false);
      onComplete();
    } catch (err) {
      console.error('Error completing payment manually:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete payment');
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

      <div className="flex gap-2">
        <Button
          onClick={checkPendingPayments}
          isLoading={loading}
          variant="secondary"
          className="flex-1"
        >
          Check Pending Payments
        </Button>
        <Button
          onClick={() => setShowManualInput(!showManualInput)}
          variant="secondary"
          className="flex-none"
        >
          {showManualInput ? 'Hide Manual' : 'Manual Complete'}
        </Button>
      </div>

      {showManualInput && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-900">Manual Payment Completion</h3>
          <Input
            label="Payment ID"
            value={manualPaymentId}
            onChange={(e) => setManualPaymentId(e.target.value)}
            placeholder="Enter payment ID"
          />
          <Input
            label="Transaction ID"
            value={manualTxid}
            onChange={(e) => setManualTxid(e.target.value)}
            placeholder="Enter transaction ID"
          />
          <Button
            onClick={handleManualComplete}
            isLoading={loading}
            className="w-full"
          >
            <Check className="h-4 w-4 mr-2" />
            Complete Payment
          </Button>
        </div>
      )}

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