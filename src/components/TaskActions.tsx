import { useState, useEffect } from 'react';
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
  const [taskState, setTaskState] = useState({
    hasAcceptedBid: false,
    hasFundedEscrow: false,
    hasSubmission: false
  });

  useEffect(() => {
    checkTaskState();
  }, [taskId, status]);

  const checkTaskState = async () => {
    if (!taskId) return;

    try {
      // Get task details with related data
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select(`
          status,
          bids!inner (
            id,
            status
          ),
          escrow_payments (
            id,
            status
          ),
          task_submissions (
            id,
            status
          )
        `)
        .eq('id', taskId)
        .eq('bids.status', 'accepted')
        .single();

      if (taskError) {
        // If no accepted bid is found, check if there's any bid accepted
        const { data: acceptedBid } = await supabase
          .from('bids')
          .select('id')
          .eq('task_id', taskId)
          .eq('status', 'accepted')
          .single();

        setTaskState({
          hasAcceptedBid: Boolean(acceptedBid),
          hasFundedEscrow: false,
          hasSubmission: false
        });
        return;
      }

      setTaskState({
        hasAcceptedBid: true,
        hasFundedEscrow: task.escrow_payments?.some(ep => ep.status === 'funded') ?? false,
        hasSubmission: task.task_submissions?.some(sub => sub.status === 'pending') ?? false
      });
    } catch (err) {
      console.error('Error checking task state:', err);
      // Don't set error here as it might be a normal case of no accepted bid
    }
  };

  const handleInitiatePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get the accepted bid
      const { data: acceptedBid, error: bidError } = await supabase
        .from('bids')
        .select('id, amount')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .single();

      if (bidError || !acceptedBid) {
        throw new Error('No accepted bid found');
      }

      // Check if escrow is already funded
      const { data: existingEscrow } = await supabase
        .from('escrow_payments')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'funded')
        .single();

      if (existingEscrow) {
        throw new Error('Escrow is already funded');
      }

      // Initiate Pi payment
      const paymentResult = await initiatePayment(acceptedBid.amount);
      
      if (!paymentResult?.paymentId || !paymentResult?.txid) {
        throw new Error('Payment failed - missing payment details');
      }

      // Create escrow payment record
      const { data: escrowId, error: escrowError } = await supabase.rpc('create_escrow_payment', {
        p_task_id: taskId,
        p_bid_id: acceptedBid.id,
        p_amount: acceptedBid.amount,
        p_payment_id: paymentResult.paymentId
      });

      if (escrowError) throw escrowError;
      if (!escrowId) throw new Error('Failed to create escrow record');

      // Update escrow payment status to funded
      const { error: updateError } = await supabase.rpc('update_escrow_payment_status', {
        p_escrow_id: escrowId,
        p_status: 'funded',
        p_txid: paymentResult.txid
      });

      if (updateError) throw updateError;

      // Update task status to in_progress
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId)
        .eq('status', 'open');

      if (taskError) throw taskError;

      await checkTaskState();
      onStatusChange();
    } catch (err) {
      console.error('Payment/escrow error:', err);
      if (err instanceof Error && !err.message.includes('Payment cancelled')) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelivery = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('pi_user_id', user.id)
        .single();

      if (profileError) throw profileError;
      if (!profile) throw new Error('Profile not found');

      // Create task submission
      const { error: submissionError } = await supabase
        .from('task_submissions')
        .insert({
          task_id: taskId,
          executor_id: profile.id,
          content: 'Task completed and delivered',
          status: 'pending'
        });

      if (submissionError) throw submissionError;

      await checkTaskState();
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
      // Get funded escrow payment and task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          id,
          executor:profiles!tasks_executor_id_fkey (
            wallet_address
          ),
          escrow_payments (
            id,
            status
          )
        `)
        .eq('id', taskId)
        .single();

      if (taskError) throw new Error('Failed to get task details');
      if (!taskData) throw new Error('Task not found');

      const escrow = taskData.escrow_payments?.find(ep => ep.status === 'funded');
      if (!escrow) throw new Error('No funded escrow payment found');

      // Get pending submission
      const { data: submissions, error: fetchError } = await supabase
        .from('task_submissions')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!submissions?.length) {
        throw new Error('No pending submission found');
      }

      // Release escrow payment
      const { error: releaseError } = await supabase
        .from('escrow_payments')
        .update({ 
          status: 'released',
          updated_at: new Date().toISOString()
        })
        .eq('id', escrow.id)
        .eq('status', 'funded');

      if (releaseError) throw releaseError;

      // Update task status
      const { error: updateTaskError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);

      if (updateTaskError) throw updateTaskError;

      // Update submission status
      const { error: updateError } = await supabase
        .from('task_submissions')
        .update({ status: 'approved' })
        .eq('id', submissions[0].id);

      if (updateError) throw updateError;

      await checkTaskState();
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

      {isCreator && status === 'open' && taskState.hasAcceptedBid && !taskState.hasFundedEscrow && (
        <Button
          onClick={handleInitiatePayment}
          isLoading={loading}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Fund Escrow ({bidAmount} π)
        </Button>
      )}

      {isExecutor && status === 'in_progress' && !taskState.hasSubmission && (
        <Button
          onClick={handleDelivery}
          isLoading={loading}
          className="w-full"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Mark as Delivered
        </Button>
      )}

      {isCreator && status === 'in_progress' && taskState.hasSubmission && (
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