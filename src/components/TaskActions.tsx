import { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/Button';
import platformAPIClient from '../lib/platformAPIClient';

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
    if (!window.Pi) {
      setError('Please use Pi Browser');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create payment data
      const paymentData = {
        amount: bidAmount,
        memo: "Task payment escrow",
        metadata: { type: "task_payment", taskId, timestamp: Date.now() }
      };

      // Create payment using Pi SDK
      window.Pi.createPayment(paymentData, {
        // When the payment is ready for approval by your server
        onReadyForServerApproval: async (paymentId: string) => {
          try {
            console.log('Payment ready for approval:', paymentId);
            
            // Verify the payment with Pi Platform API
            const response = await platformAPIClient.get(`/payments/${paymentId}`);
            console.log('Payment verification:', response.data);
            
            // Approve the payment
            await platformAPIClient.post(`/payments/${paymentId}/approve`);
            console.log('Payment approved');
          } catch (err) {
            console.error('Payment approval error:', err);
            setError('Payment approval failed. Please try again.');
            setLoading(false);
          }
        },

        // When the payment is ready to be completed by your server
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          try {
            console.log('Payment ready for completion:', { paymentId, txid });

            // First create and fund the escrow payment record
            const { data: escrowId, error: escrowError } = await supabase.rpc('create_escrow_payment', {
              p_task_id: taskId,
              p_bid_id: null, // We don't need bid_id for direct payments
              p_amount: bidAmount,
              p_payment_id: paymentId
            });

            if (escrowError) {
              console.error('Escrow creation error:', escrowError);
              throw new Error('Failed to create escrow record');
            }

            // Complete the payment with Pi Platform API
            await platformAPIClient.post(`/payments/${paymentId}/complete`, { txid });
            console.log('Payment completed with Pi Platform');

            // Update escrow payment status to funded
            const { error: updateError } = await supabase.rpc('update_escrow_payment_status', {
              p_escrow_id: escrowId,
              p_status: 'funded',
              p_txid: txid
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
            console.error('Payment completion error:', err);
            setError(err instanceof Error ? err.message : 'Payment completion failed');
          } finally {
            setLoading(false);
          }
        },

        onCancel: (paymentId: string) => {
          console.log('Payment cancelled:', paymentId);
          setError('Payment was cancelled');
          setLoading(false);
        },

        onError: (error: Error, payment?: any) => {
          console.error('Payment error:', error, payment);
          setError(error.message);
          setLoading(false);
        }
      });
    } catch (err) {
      console.error('Payment initiation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
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

      console.log('Task approved and payment released');
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