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
      // Create escrow payment record first
      const { data: escrow, error: escrowError } = await supabase.rpc('create_escrow_payment', {
        p_task_id: taskId,
        p_bid_id: null, // This will be updated after payment
        p_amount: bidAmount,
        p_payment_id: 'pending' // Temporary value
      });

      if (escrowError) throw escrowError;
      if (!escrow) throw new Error('Failed to create escrow record');

      // Initiate Pi payment
      const result = await initiatePayment(bidAmount);
      
      if (!result?.paymentId || !result?.txid) {
        throw new Error('Payment failed');
      }

      // Update escrow payment with actual payment details
      const { error: updateError } = await supabase.rpc('update_escrow_payment_status', {
        p_escrow_id: escrow,
        p_status: 'funded',
        p_txid: result.txid
      });

      if (updateError) throw updateError;

      // Update task status
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);

      if (taskError) throw taskError;

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
      // First get the user's profile ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('pi_user_id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Profile not found');

      // Create task submission with profile ID
      const { data: submission, error: submissionError } = await supabase
        .from('task_submissions')
        .insert({
          task_id: taskId,
          executor_id: profile.id,
          content: 'Task completed and delivered',
          status: 'pending'
        })
        .select()
        .single();

      if (submissionError) throw submissionError;
      if (!submission) throw new Error('Failed to create submission');

      onStatusChange();
    } catch (err) {
      console.error('Delivery error:', err);
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
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!submissions?.length) throw new Error('No pending submission found');

      // Get escrow payment
      const { data: escrow, error: escrowError } = await supabase
        .from('escrow_payments')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'funded')
        .single();

      if (escrowError) throw escrowError;
      if (!escrow) throw new Error('No funded escrow payment found');

      // Approve the submission and release payment
      const { error: releaseError } = await supabase.rpc('release_escrow_payment', {
        p_task_id: taskId,
        p_escrow_id: escrow.id
      });

      if (releaseError) throw releaseError;

      // Update submission status
      const { error: updateError } = await supabase
        .from('task_submissions')
        .update({ status: 'approved' })
        .eq('id', submissions[0].id);

      if (updateError) throw updateError;

      onStatusChange();
    } catch (err) {
      console.error('Approval error:', err);
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