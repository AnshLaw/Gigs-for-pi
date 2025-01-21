import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { initiatePayment } from '../lib/payments';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import { PendingPaymentHandler } from './PendingPaymentHandler';

interface TaskActionsProps {
  taskId: string;
  status: string;
  isCreator: boolean;
  isExecutor: boolean;
  bidAmount: number;
  onStatusChange: () => void;
}

interface TaskWithExecutor {
  executor_id: string;
  executor: {
    wallet_address: string | null;
  } | null;
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
  const [showPendingHandler, setShowPendingHandler] = useState(false);
  const [hasAcceptedBid, setHasAcceptedBid] = useState(false);
  const [hasFundedEscrow, setHasFundedEscrow] = useState(false);

  useEffect(() => {
    if (isCreator) {
      checkBidAndEscrowStatus();
    }
  }, [isCreator, taskId]);

  const checkBidAndEscrowStatus = async () => {
    try {
      // Check if there's an accepted bid
      const { data: acceptedBid } = await supabase
        .from('bids')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .single();

      setHasAcceptedBid(!!acceptedBid);

      if (acceptedBid) {
        // Check if escrow is funded
        const { data: escrow } = await supabase
          .from('escrow_payments')
          .select('id')
          .eq('task_id', taskId)
          .eq('status', 'funded')
          .single();

        setHasFundedEscrow(!!escrow);
      }
    } catch (err) {
      console.error('Error checking bid/escrow status:', err);
    }
  };

  const handleInitiatePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // First check if there's an accepted bid
      const { data: acceptedBid, error: bidError } = await supabase
        .from('bids')
        .select('id, amount')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .single();

      if (bidError || !acceptedBid) {
        throw new Error('No accepted bid found. Please accept a bid first.');
      }

      // Check if escrow is already funded
      const { data: existingEscrow } = await supabase
        .from('escrow_payments')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'funded')
        .single();

      if (existingEscrow) {
        throw new Error('Escrow is already funded for this task.');
      }

      // Initiate Pi payment
      console.log('Initiating payment for amount:', acceptedBid.amount);
      const paymentResult = await initiatePayment(acceptedBid.amount);
      
      if (!paymentResult?.paymentId || !paymentResult?.txid) {
        throw new Error('Payment failed - missing payment details');
      }

      console.log('Payment successful:', paymentResult);

      // Create and fund the escrow payment record
      const { data: escrowId, error: escrowError } = await supabase.rpc('create_escrow_payment', {
        p_task_id: taskId,
        p_bid_id: acceptedBid.id,
        p_amount: acceptedBid.amount,
        p_payment_id: paymentResult.paymentId
      });

      if (escrowError) {
        console.error('Escrow creation error:', escrowError);
        throw new Error('Failed to create escrow record');
      }

      if (!escrowId) {
        console.error('No escrow ID returned');
        throw new Error('Failed to create escrow record');
      }

      console.log('Escrow created with ID:', escrowId);

      // Update escrow payment status to funded
      const { error: updateError } = await supabase.rpc('update_escrow_payment_status', {
        p_escrow_id: escrowId,
        p_status: 'funded',
        p_txid: paymentResult.txid
      });

      if (updateError) {
        console.error('Escrow status update error:', updateError);
        throw new Error('Failed to update escrow status');
      }

      // Update task status to in_progress
      const { error: taskError } = await supabase
        .from('tasks')
        .update({ status: 'in_progress' })
        .eq('id', taskId);

      if (taskError) {
        console.error('Task status update error:', taskError);
        throw new Error('Failed to update task status');
      }

      console.log('Escrow status updated to funded');
      setHasFundedEscrow(true);
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
      // Get the user's profile ID
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

      console.log('Task marked as delivered');
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
      // First check if escrow is funded
      const { data: escrow, error: escrowError } = await supabase
        .from('escrow_payments')
        .select('id, amount')
        .eq('task_id', taskId)
        .eq('status', 'funded')
        .single();

      if (escrowError || !escrow) {
        throw new Error('Task escrow has not been funded yet. Please fund the escrow first.');
      }

      // Then check for pending submission
      const { data: submissions, error: fetchError } = await supabase
        .from('task_submissions')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!submissions?.length) {
        throw new Error('No pending submission found. Please wait for the executor to mark the task as delivered.');
      }

      // Get executor's profile to get their wallet address
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select<string, TaskWithExecutor>(`
          executor_id,
          executor:profiles!tasks_executor_id_fkey (
            wallet_address
          )
        `)
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      if (!task?.executor?.wallet_address) {
        throw new Error('Executor has not set up their wallet address');
      }

      // Initiate payment to executor
      const paymentResult = await initiatePayment(escrow.amount);
      
      if (!paymentResult?.paymentId || !paymentResult?.txid) {
        throw new Error('Payment to executor failed');
      }

      // Release the escrow payment
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
      if (err instanceof Error && err.message.includes('pending payment')) {
        setShowPendingHandler(true);
      }
      setError(err instanceof Error ? err.message : 'Failed to approve task');
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

      {showPendingHandler ? (
        <PendingPaymentHandler 
          onComplete={() => {
            setShowPendingHandler(false);
            setError(null);
          }} 
        />
      ) : (
        <>
          {isCreator && status === 'open' && (
            <>
              {!hasAcceptedBid ? (
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                  Accept a bid to proceed with funding the escrow.
                </div>
              ) : !hasFundedEscrow ? (
                <Button
                  onClick={handleInitiatePayment}
                  isLoading={loading}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Fund Escrow ({bidAmount} π)
                </Button>
              ) : (
                <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                  Escrow has been funded. Waiting for task completion.
                </div>
              )}
            </>
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
        </>
      )}
    </div>
  );
}