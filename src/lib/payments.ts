import { supabase } from './supabase';

declare global {
  interface Window {
    Pi: {
      init: (config: { version: string, sandbox?: boolean }) => void;
      authenticate: (scopes: string[], onIncompletePaymentFound: (payment: any) => void) => Promise<{
        accessToken: string;
        user: {
          uid: string;
          username: string;
        };
      }>;
      createPayment: (payment: {
        amount: number,
        memo: string,
        metadata: Record<string, any>
      }) => Promise<{
        identifier: string;
        status: {
          developer_approved: boolean;
          transaction_verified: boolean;
          developer_completed: boolean;
          cancelled: boolean;
          user_cancelled: boolean;
        };
      }>;
      completePayment: (paymentId: string, txid: string) => Promise<void>;
    };
  }
}

export async function initiateEscrowPayment(taskId: string, bidId: string, amount: number) {
  try {
    if (!window.Pi) {
      throw new Error('Pi Network SDK not found');
    }

    // Create Pi payment
    const payment = await window.Pi.createPayment({
      amount: amount,
      memo: `Escrow payment for task ${taskId}`,
      metadata: { taskId, bidId, type: 'escrow' }
    });

    if (!payment.identifier) {
      throw new Error('Failed to create payment');
    }

    // Create escrow record
    const { data: escrow, error: escrowError } = await supabase.rpc(
      'accept_bid_with_escrow',
      {
        p_task_id: taskId,
        p_bid_id: bidId,
        p_executor_id: bidId, // This will be the bidder's profile ID
        p_payment_id: payment.identifier
      }
    );

    if (escrowError) throw escrowError;

    return {
      paymentId: payment.identifier,
      escrowId: escrow
    };
  } catch (err) {
    console.error('Error initiating escrow payment:', err);
    throw err;
  }
}

export async function verifyEscrowPayment(escrowId: string, paymentId: string) {
  try {
    // Update escrow payment status to funded
    const { error: updateError } = await supabase.rpc(
      'update_escrow_payment_status',
      {
        p_escrow_id: escrowId,
        p_status: 'funded',
        p_txid: paymentId
      }
    );

    if (updateError) throw updateError;

    return true;
  } catch (err) {
    console.error('Error verifying escrow payment:', err);
    throw err;
  }
}

export async function submitTaskCompletion(taskId: string, content: string) {
  try {
    const { data: submission, error } = await supabase.rpc(
      'submit_task_completion',
      {
        p_task_id: taskId,
        p_content: content
      }
    );

    if (error) throw error;
    return submission;
  } catch (err) {
    console.error('Error submitting task completion:', err);
    throw err;
  }
}

export async function reviewTaskSubmission(
  taskId: string,
  submissionId: string,
  approved: boolean,
  feedback: string
) {
  try {
    const { error } = await supabase.rpc(
      'review_task_submission',
      {
        p_task_id: taskId,
        p_submission_id: submissionId,
        p_approved: approved,
        p_feedback: feedback
      }
    );

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error reviewing task submission:', err);
    throw err;
  }
}