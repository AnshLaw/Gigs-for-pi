import { useState } from 'react';
import { initiatePayment } from '../lib/payments';
import { Button } from './ui/Button';

interface PaymentButtonProps {
  amount?: number;
  onSuccess?: (result: any) => void;
}

export function PaymentButton({ amount = 1, onSuccess }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await initiatePayment(amount);
      console.log('Payment result:', result);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handlePayment}
        disabled={loading}
        isLoading={loading}
        variant="primary"
      >
        {loading ? 'Processing...' : `Pay ${amount} π`}
      </Button>
      
      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}