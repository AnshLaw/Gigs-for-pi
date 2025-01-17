import { useState } from 'react';
import { initiatePayment } from '../lib/payments';
import { Button } from './ui/Button';

export function PaymentButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await initiatePayment(1); // 1 Pi test payment
      console.log('Payment successful:', result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      
      <Button
        onClick={handlePayment}
        disabled={loading}
        isLoading={loading}
      >
        Pay 1 π
      </Button>
    </div>
  );
}