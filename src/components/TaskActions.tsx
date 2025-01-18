import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { initiatePayment } from '../lib/payments';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';

interface TaskActionsProps {
  taskId: string;
  status: string;
  isCreator: boolean;
  isExecutor: boolean;
  bidAmount: number;
  onStatusChange: () => void;
}

interface PaymentResult {
  status: string;
  paymentId: string;
  txid: string;
}

export function TaskActions({ 
  taskId, 
  status, 
  isCreator, 
  isExecutor,
  bidAmount,
  onStatusChange 
}: TaskActionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInitiatePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create escrow payment
      const result = await initiatePayment(bidAmount) as PaymentResult;
      
      if (!result?.paymentId || !result?.txid) {
        throw new Error('Payment failed');
      }

      // Update escrow payment status in database
      const { error: dbError } = await supabase.rpc('update_escrow_payment_status', {
        p_escrow_id: result.paymentId,
        p_status: 'funded',
        p_txid: result.txid
      });

      if (dbError) throw dbError;
      onStatusChange();
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelivery = async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: submissionError } = await supabase.rpc('submit_task_completion', {
        p_task_id: taskId,
        p_content: 'Task completed and delivered'
      });

      if (submissionError) throw submissionError;
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as delivered');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the latest submission
      const { data: submissions, error: fetchError } = await supabase
        .from('task_submissions')
        .select('id')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!submissions?.length) throw new Error('No submission found');

      // Approve the submission
      const { error: approvalError } = await supabase.rpc('review_task_submission', {
        p_task_id: taskId,
        p_submission_id: submissions[0].id,
        p_approved: true,
        p_feedback: 'Task approved and completed'
      });

      if (approvalError) throw approvalError;
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve task');
    } finally {
      setLoading(false);
    }
  };

  if (!isCreator && !isExecutor) return null;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {isCreator && status === 'open' && (
        <Button
          onClick={handleInitiatePayment}
          isLoading={loading}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Fund Escrow ({bidAmount} π)
        </Button>
      )}

      {isExecutor && status === 'in_progress' && (
        <Button
          onClick={handleDelivery}
          isLoading={loading}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark as Delivered
        </Button>
      )}

      {isCreator && status === 'in_progress' && (
        <Button
          onClick={handleApproval}
          isLoading={loading}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Approve & Release Payment
        </Button>
      )}
    </div>
  );
}