import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { AlertCircle, Check } from 'lucide-react';
import { TaskActions } from '../components/TaskActions';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { Task, Bid } from '../lib/types';

interface TaskWithRelations extends Task {
  creator?: {
    username: string;
    rating: number;
  };
  executor?: {
    username: string;
    rating: number;
  };
}

interface BidWithBidder extends Bid {
  bidder?: {
    username: string;
    rating: number;
  };
}

export function TaskDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [bids, setBids] = useState<BidWithBidder[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [acceptingBid, setAcceptingBid] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);

  const isCreator = Boolean(profile && task && profile.id === task.creator_id);
  const hasUserBid = Boolean(profile && bids.some(bid => bid.bidder_id === profile.id));

  useEffect(() => {
    if (id) {
      fetchTaskAndBids();
    }
  }, [id]);

  const fetchTaskAndBids = async () => {
    try {
      // Fetch task with creator and executor details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:profiles!tasks_creator_id_fkey (
            username,
            rating
          ),
          executor:profiles!tasks_executor_id_fkey (
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
      console.error('Error fetching task and bids:', err);
    }
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !task) return;

    setSubmittingBid(true);
    setBidError(null);

    try {
      const amount = parseFloat(bidAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid bid amount');
      }

      const { error: bidError } = await supabase
        .from('bids')
        .insert({
          task_id: task.id,
          bidder_id: profile.id,
          amount: amount,
          status: 'pending'
        });

      if (bidError) throw bidError;

      setBidAmount('');
      await fetchTaskAndBids();
    } catch (err) {
      console.error('Error submitting bid:', err);
      setBidError(err instanceof Error ? err.message : 'Failed to submit bid');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleAcceptBid = async (bid: BidWithBidder) => {
    if (!task || !bid.bidder_id) return;

    setAcceptingBid(true);
    setBidError(null);

    try {
      const { error } = await supabase.rpc('accept_bid', {
        p_task_id: task.id,
        p_bid_id: bid.id,
        p_executor_id: bid.bidder_id
      });

      if (error) throw error;
      await fetchTaskAndBids();
    } catch (err) {
      console.error('Error accepting bid:', err);
      setBidError(err instanceof Error ? err.message : 'Failed to accept bid');
    } finally {
      setAcceptingBid(false);
    }
  };

  if (!task) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{task.title}</h1>
          <p className="text-gray-600 mb-6">{task.description}</p>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              Status: {task.status.replace('_', ' ').toUpperCase()}
            </div>
            <div className="flex items-center">
              <Check className="h-4 w-4 mr-1" />
              Payment: {task.payment_amount} π
            </div>
          </div>

          {task.creator && (
            <div className="text-sm text-gray-600">
              Posted by: {task.creator.username} ({task.creator.rating.toFixed(1)} ★)
            </div>
          )}
        </div>

        {task.status === 'open' && (
          <div className="border-t">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Bids</h2>
              
              {!user ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Please sign in to place a bid</p>
                </div>
              ) : profile?.id === task.creator_id ? (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">
                    This is your gig. Wait for others to place their bids.
                  </div>
                  {bids.length > 0 && (
                    <div className="mt-2 text-sm text-indigo-600">
                      You can accept a bid to proceed with the task.
                    </div>
                  )}
                </div>
              ) : hasUserBid ? (
                <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">
                    You have already placed a bid on this gig.
                  </div>
                </div>
              ) : (
                <div className="mb-6">
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
                  <div className="text-center py-8">
                    <p className="text-gray-500">No bids yet</p>
                  </div>
                ) : (
                  bids.map((bid) => (
                    <div
                      key={bid.id}
                      className="bg-gray-50 p-4 rounded-lg"
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
          </div>
        )}

        {task && profile && (
          <div className="border-t p-6">
            <TaskActions
              taskId={task.id}
              status={task.status}
              isCreator={profile.id === task.creator_id}
              isExecutor={profile.id === task.executor_id}
              bidAmount={task.payment_amount}
              onStatusChange={fetchTaskAndBids}
            />
          </div>
        )}
      </div>
    </div>
  );
}