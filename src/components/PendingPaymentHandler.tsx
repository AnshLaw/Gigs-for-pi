import { useState } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { Button } from './ui/Button';
import platformAPIClient from '../lib/platformAPIClient';

interface PendingPayment {
  identifier: string;
  transaction?: {
    txid: string;
  };
}

export function PendingPaymentHandler({ onComplete }: { onComplete: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);

  const checkPendingPayments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await new Promise<void>((resolve) => {
        window.Pi.authenticate(['payments'], (auth: any) => {
          if (auth.payments && auth.payments.length > 0) {
            setPendingPayments(auth.payments);
          }
          resolve();
        });
      });
    } catch (err) {
      console.error('Error checking pending payments:', err);
      setError('Failed to check pending payments');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (payment: PendingPayment, action: 'complete' | 'cancel') => {
    setLoading(true);
    setError(null);

    try {
      const paymentId = payment.identifier;
      
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
      setError('Failed to handle payment');
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
              <div className="text-sm">
                <p className="font-medium">Payment ID: {payment.identifier}</p>
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