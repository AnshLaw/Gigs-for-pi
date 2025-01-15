import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { Clock, DollarSign, Users, AlertCircle, Check, X } from 'lucide-react';
import { initiateEscrowPayment, verifyEscrowPayment } from '../lib/payments';
import { TaskSubmissionForm } from '../components/TaskSubmissionForm';
import { TaskReviewForm } from '../components/TaskReviewForm';
import type { Task, Bid } from '../lib/types';

export function TaskDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [task, setTask] = useState<Task | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [submission, setSubmission] = useState<any>(null);
  const [updatingBidId, setUpdatingBidId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTaskAndBids();
    }
  }, [id]);

  useEffect(() => {
    if (task?.status === 'in_progress') {
      fetchSubmission();
    }
  }, [task?.status]);

  const fetchTaskAndBids = async () => {
    try {
      // Fetch task with creator details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:profiles!tasks_creator_id_fkey (
            username,
            rating
          )
        `)
        .eq('id', id)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      // Fetch bids with bidder details
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          *,
          bidder:profiles!bids_bidder_id_fkey (
            username,
            rating
          )
        `)
        .eq('task_id', id)
        .order('created_at', { ascending: false });

      if (bidsError) throw bidsError;
      setBids(bidsData || []);
    } catch (err) {
      console.error('Error fetching task details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmission = async () => {
    if (!task) return;

    try {
      const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setSubmission(data);
    } catch (err) {
      console.error('Error fetching submission:', err);
    }
  };

  const handleAcceptBid = async (bidId: string, amount: number) => {
    if (!task || !profile) return;
    
    setProcessingPayment(true);
    setError(null);

    try {
      // Initiate escrow payment
      const { paymentId, escrowId } = await initiateEscrowPayment(
        task.id,
        bidId,
        amount
      );

      // Verify payment
      await verifyEscrowPayment(escrowId, paymentId);

      // Refresh task details
      await fetchTaskAndBids();
    } catch (err) {
      console.error('Error processing payment:', err);
      setError(err instanceof Error ? err.message : 'Failed to process payment');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleBidAction = async (bidId: string, action: 'accept' | 'reject') => {
    if (!task || !profile) return;

    setUpdatingBidId(bidId);
    setError(null);

    try {
      const bid = bids.find((b) => b.id === bidId);
      if (!bid) throw new Error('Bid not found');

      if (action === 'reject') {
        const { error: bidError } = await supabase
          .from('bids')
          .update({ status: 'rejected' })
          .eq('id', bidId);

        if (bidError) throw bidError;
        await fetchTaskAndBids();
      } else {
        await handleAcceptBid(bidId, bid.amount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bid');
    } finally {
      setUpdatingBidId(null);
    }
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !task) return;

    setSubmittingBid(true);
    setError(null);

    try {
      const { error: bidError } = await supabase
        .from('bids')
        .insert({
          task_id: task.id,
          bidder_id: profile.id,
          amount: parseFloat(bidAmount),
        });

      if (bidError) throw bidError;

      setBidAmount('');
      fetchTaskAndBids();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
    } finally {
      setSubmittingBid(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-600">Loading task details...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Gig not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          The gig you're looking for doesn't exist or has been removed.
        </p>
        <div className="mt-6">
          <Link
            to="/tasks"
            className="text-indigo-600 hover:text-indigo-500 font-medium"
          >
            Back to Gigs
          </Link>
        </div>
      </div>
    );
  }

  const userBid = profile && bids.find(bid => bid.bidder_id === profile.id);
  const isCreator = profile && task.creator_id === profile.id;
  const canBid = user && !isCreator && task.status === 'open' && !userBid;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/tasks"
          className="text-indigo-600 hover:text-indigo-500 font-medium"
        >
          ← Back to Gigs
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {task.title}
              </h1>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-1" />
                Posted {new Date(task.created_at).toLocaleDateString()}
              </div>
            </div>
            <div className="flex items-center">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              <span className="text-2xl font-bold text-indigo-600">
                {task.payment_amount} π
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Description
            </h2>
            <p className="text-gray-600 whitespace-pre-wrap">
              {task.description}
            </p>
          </div>

          <div className="flex items-center justify-between py-3 border-t">
            <div className="flex items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                task.status === 'open'
                  ? 'bg-green-100 text-green-800'
                  : task.status === 'in_progress'
                  ? 'bg-yellow-100 text-yellow-800'
                  : task.status === 'completed'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {task.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <Users className="w-4 h-4 mr-1" />
              {bids.length} bid{bids.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {canBid && (
        <div className="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Place Your Bid
            </h2>
            <form onSubmit={handleSubmitBid} className="space-y-4">
              <div>
                <label
                  htmlFor="bidAmount"
                  className="block text-sm font-medium text-gray-700"
                >
                  Bid Amount (π)
                </label>
                <input
                  type="number"
                  id="bidAmount"
                  required
                  min="0.01"
                  step="0.01"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={submittingBid}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {submittingBid ? 'Submitting...' : 'Submit Bid'}
              </button>
            </form>
          </div>
        </div>
      )}

      {userBid && (
        <div className="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Your Bid
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-1 text-gray-500" />
                <span className="font-medium">{userBid.amount} π</span>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                userBid.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800'
                  : userBid.status === 'accepted'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {userBid.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {isCreator && task.status === 'open' && bids.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Manage Bids
            </h2>
            <div className="space-y-4">
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-center justify-between py-3 border-b last:border-b-0"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {bid.bidder?.username || 'Unknown User'}
                    </div>
                    <div className="flex items-center text-sm text-gray-500">
                      <DollarSign className="w-4 h-4 mr-1" />
                      {bid.amount} π
                    </div>
                  </div>
                  {bid.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptBid(bid.id, bid.amount)}
                        disabled={processingPayment || updatingBidId === bid.id}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        {processingPayment && updatingBidId === bid.id ? 'Processing...' : 'Accept & Pay'}
                      </button>
                      <button
                        onClick={() => handleBidAction(bid.id, 'reject')}
                        disabled={processingPayment || updatingBidId === bid.id}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </button>
                    </div>
                  )}
                  {bid.status !== 'pending' && (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      bid.status === 'accepted'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {bid.status.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {task.status === 'in_progress' && (
        <div className="mt-6 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Task Submission
            </h2>
            {submission ? (
              <>
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700">Submission Details</h3>
                  <p className="mt-1 text-gray-600">{submission.content}</p>
                  <p className="mt-2 text-sm text-gray-500">
                    Submitted on {new Date(submission.created_at).toLocaleDateString()}
                  </p>
                </div>
                {isCreator && submission.status === 'pending' && (
                  <>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Review Submission</h3>
                    <TaskReviewForm
                      taskId={task.id}
                      submissionId={submission.id}
                      onReview={fetchTaskAndBids}
                    />
                  </>
                )}
              </>
            ) : (
              task.executor_id === profile?.id && (
                <TaskSubmissionForm
                  taskId={task.id}
                  onSubmit={() => {
                    fetchSubmission();
                    fetchTaskAndBids();
                  }}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}