import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { Clock, DollarSign, Check, Download, Paperclip } from 'lucide-react';
import { TaskActions } from '../components/TaskActions';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { Task, Bid, TaskAttachment } from '../lib/types';

interface TaskWithRelations extends Task {
  creator?: {
    username: string;
    rating: number;
  };
  executor?: {
    username: string;
    rating: number;
  };
  attachments?: TaskAttachment[];
}

export function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acceptingBid, setAcceptingBid] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);

  const fetchTaskAndBids = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:profiles!tasks_creator_id_fkey(username, rating),
          executor:profiles!tasks_executor_id_fkey(username, rating),
          attachments:task_attachments(*)
        `)
        .eq('id', id)
        .single();

      if (taskError) throw taskError;

      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          *,
          bidder:profiles(username, rating)
        `)
        .eq('task_id', id)
        .order('created_at', { ascending: false });

      if (bidsError) throw bidsError;

      setTask(taskData);
      setBids(bidsData || []);
    } catch (err) {
      console.error('Error fetching task details:', err);
      setError('Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskAndBids();
  }, [id]);

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !profile || !bidAmount) return;

    setSubmittingBid(true);
    setBidError(null);

    try {
      // Validate bid amount
      const amount = parseFloat(bidAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid bid amount');
      }

      // Create the bid
      const { error: bidError } = await supabase
        .from('bids')
        .insert({
          task_id: task.id,
          bidder_id: profile.id,
          amount: amount,
          status: 'pending'
        });

      if (bidError) throw bidError;

      // Clear form and refresh bids
      setBidAmount('');
      await fetchTaskAndBids();
    } catch (err) {
      console.error('Error submitting bid:', err);
      setBidError(err instanceof Error ? err.message : 'Failed to submit bid');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleAcceptBid = async (bid: Bid) => {
    if (!task || !profile) return;

    setAcceptingBid(true);

    try {
      // Update bid status to accepted
      const { error: bidUpdateError } = await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('id', bid.id);

      if (bidUpdateError) throw bidUpdateError;

      // Update task status and executor
      const { error: taskUpdateError } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          executor_id: bid.bidder_id
        })
        .eq('id', task.id);

      if (taskUpdateError) throw taskUpdateError;

      // Reject other pending bids
      const { error: rejectBidsError } = await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('task_id', task.id)
        .eq('status', 'pending')
        .neq('id', bid.id);

      if (rejectBidsError) throw rejectBidsError;

      // Refresh task and bids
      await fetchTaskAndBids();
    } catch (err) {
      console.error('Error accepting bid:', err);
      setError('Failed to accept bid');
    } finally {
      setAcceptingBid(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!task) {
    return <div>Task not found</div>;
  }

  const isCreator = profile?.id === task?.creator_id;
  const isExecutor = profile?.id === task?.executor_id;
  const canBid = user && !isCreator && task?.status === 'open';
  const hasUserBid = bids.some(bid => bid.bidder_id === profile?.id);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{task.title}</h1>
            <div className="flex items-center space-x-4 text-gray-600 mb-4">
              <div className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                <span>{new Date(task.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                <span>{task.payment_amount} π</span>
              </div>
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              task.status === 'open'
                ? 'bg-green-100 text-green-800'
                : task.status === 'in_progress'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {task.status.replace('_', ' ').toUpperCase()}
            </div>
          </div>
          {(isCreator || isExecutor) && (
            <TaskActions
              taskId={task.id}
              status={task.status}
              isCreator={isCreator}
              isExecutor={isExecutor}
              bidAmount={task.payment_amount}
              onStatusChange={fetchTaskAndBids}
            />
          )}
        </div>
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-gray-700">{task.description}</p>
        </div>
        {task.attachments && task.attachments.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Attachments</h2>
            <div className="space-y-2">
              {task.attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center bg-gray-100 p-2 rounded-md">
                  <Paperclip className="h-5 w-5 mr-2 text-gray-600" />
                  <span className="flex-1 truncate">{attachment.file_name}</span>
                  <span className="text-sm text-gray-500 mx-2">
                    ({Math.round(attachment.file_size / 1024)} KB)
                  </span>
                  <a
                    href={`${supabase.storage.from('attachments').getPublicUrl(attachment.file_path).data.publicUrl}`}
                    download={attachment.file_name}
                    className="p-1 text-gray-600 hover:text-gray-900"
                  >
                    <Download className="h-5 w-5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {task?.status === 'open' && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Bids</h2>
          
          {canBid && !hasUserBid && (
            <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Place Your Bid</h3>
              <form onSubmit={handleSubmitBid} className="space-y-4">
                {bidError && (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                    {bidError}
                  </div>
                )}
                <div>
                  <Input
                    type="number"
                    label="Bid Amount (π)"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    placeholder="Enter your bid amount"
                  />
                </div>
                <Button
                  type="submit"
                  isLoading={submittingBid}
                  className="w-full"
                >
                  Submit Bid
                </Button>
              </form>
            </div>
          )}

          <div className="space-y-4">
            {bids.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg shadow-md">
                <p className="text-gray-500">No bids yet</p>
                {!user && (
                  <p className="mt-2 text-sm text-gray-500">
                    Please sign in to place a bid
                  </p>
                )}
              </div>
            ) : (
              bids.map((bid) => (
                <div
                  key={bid.id}
                  className="bg-white p-4 rounded-lg shadow-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {bid.bidder && (
                        <>
                          <span className="font-medium">
                            {bid.bidder.username}
                          </span>
                          <span className="text-sm text-gray-500">
                            ({bid.bidder.rating.toFixed(1)} ★)
                          </span>
                        </>
                      )}
                    </div>
                    <div className="font-medium text-indigo-600">
                      {bid.amount} π
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {new Date(bid.created_at).toLocaleString()}
                    </span>
                    {isCreator && task.status === 'open' && bid.status === 'pending' && (
                      <Button
                        onClick={() => handleAcceptBid(bid)}
                        isLoading={acceptingBid}
                        size="sm"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept Bid
                      </Button>
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
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}