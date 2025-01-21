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

  // Check if there's an accepted bid when component mounts
  useEffect(() => {
    const checkAcceptedBid = async () => {
      try {
        const { error: bidError } = await supabase
          .from('bids')
          .select('id')
          .eq('task_id', taskId)
          .eq('status', 'accepted')
          .single();

        if (bidError) {
          if (bidError.code !== 'PGRST116') { // No rows returned
            console.error('Error checking accepted bid:', bidError);
          }
          setHasAcceptedBid(false);
        } else {
          setHasAcceptedBid(true);
        }
      } catch (err) {
        console.error('Error checking accepted bid:', err);
        setHasAcceptedBid(false);
      }
    };

    if (status === 'open') {
      checkAcceptedBid();
    }
  }, [taskId, status]);

  const handleInitiatePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Verify there's an accepted bid first
      const { data: acceptedBid, error: bidError } = await supabase
        .from('bids')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'accepted')
        .single();

      if (bidError) {
        throw new Error('Please accept a bid before funding escrow');
      }

      // Initiate and complete the Pi payment
      const paymentResult = await initiatePayment(bidAmount);
      
      if (!paymentResult?.paymentId || !paymentResult?.txid) {
        throw new Error('Payment failed - missing payment details');
      }

      // Create and fund the escrow payment record
      const { data: escrowId, error: escrowError } = await supabase.rpc('create_escrow_payment', {
        p_task_id: taskId,
        p_bid_id: acceptedBid.id,
        p_amount: bidAmount,
        p_payment_id: paymentResult.paymentId
      });

      if (escrowError) {
        console.error('Escrow creation error:', escrowError);
        throw new Error('Failed to create escrow record');
      }

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
        .eq('id', taskId)
        .eq('status', 'open');

      if (taskError) {
        console.error('Task status update error:', taskError);
        throw new Error('Failed to update task status');
      }

      console.log('Payment and escrow process completed successfully');
      onStatusChange();
    } catch (err) {
      console.error('Payment/escrow error:', err);
      if (err instanceof Error && err.message.includes('pending payment')) {
        setShowPendingHandler(true);
      }
      setError(err instanceof Error ? err.message : 'Payment failed');
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
      // Get the latest pending submission
      const { data: submissions, error: fetchError } = await supabase
        .from('task_submissions')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      if (!submissions?.length) throw new Error('No pending submission found');

      // Get the funded escrow payment
      const { data: escrow, error: escrowError } = await supabase
        .from('escrow_payments')
        .select('id')
        .eq('task_id', taskId)
        .eq('status', 'funded')
        .single();

      if (escrowError) throw escrowError;
      if (!escrow) throw new Error('No funded escrow payment found');

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
              ) : (
                <Button
                  onClick={handleInitiatePayment}
                  isLoading={loading}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Fund Escrow ({bidAmount} π)
                </Button>
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