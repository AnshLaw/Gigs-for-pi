import { useState } from 'react';
import { initiatePayment } from '../lib/payments';
import { Button } from './ui/Button';
import { AlertCircle } from 'lucide-react';

interface PaymentButtonProps {
  amount?: number;
  onSuccess?: (result: any) => void;
  className?: string;
}

export function PaymentButton({ amount = 1, onSuccess, className }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await initiatePayment(amount);
      console.log('Payment completed:', result);
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
    <div className={`space-y-2 ${className}`}>
      <Button
        onClick={handlePayment}
        disabled={loading}
        isLoading={loading}
        variant="primary"
      >
        {loading ? 'Processing...' : `Pay ${amount} π`}
      </Button>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}