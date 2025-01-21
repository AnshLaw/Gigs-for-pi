import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { Clock, DollarSign, AlertCircle, Check, Download, Paperclip } from 'lucide-react';
import { TaskActions } from '../components/TaskActions';
import { Button } from '../components/ui/Button';
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

  useEffect(() => {
    if (id) {
      fetchTaskAndBids();
    }
  }, [id]);

  const fetchTaskAndBids = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

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
          ),
          attachments:task_attachments (
            id,
            file_path,
            file_name,
            file_type,
            file_size
          )
        `)
        .eq('id', id)
        .single();

      if (taskError) throw taskError;

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

      setTask(taskData);
      setBids(bidsData || []);
    } catch (err) {
      console.error('Error fetching task details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bid: Bid) => {
    if (!task || !profile) return;

    try {
      setAcceptingBid(true);
      setError(null);

      // First update the bid status
      const { error: bidError } = await supabase
        .from('bids')
        .update({ status: 'accepted' })
        .eq('id', bid.id)
        .eq('task_id', task.id);

      if (bidError) throw bidError;

      // Reject all other bids
      const { error: rejectError } = await supabase
        .from('bids')
        .update({ status: 'rejected' })
        .eq('task_id', task.id)
        .neq('id', bid.id);

      if (rejectError) throw rejectError;

      // Update task with executor and new payment amount
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          executor_id: bid.bidder_id,
          payment_amount: bid.amount
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Refresh task and bids data
      await fetchTaskAndBids();
    } catch (err) {
      console.error('Error accepting bid:', err);
      setError(err instanceof Error ? err.message : 'Failed to accept bid');
    } finally {
      setAcceptingBid(false);
    }
  };

  const handleStatusChange = () => {
    fetchTaskAndBids();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-600">Loading task details...</div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600">{error || 'Task not found'}</p>
        <Link
          to="/tasks"
          className="mt-4 text-indigo-600 hover:text-indigo-500"
        >
          Back to Tasks
        </Link>
      </div>
    );
  }

  const isCreator = profile?.id === task.creator_id;
  const isExecutor = profile?.id === task.executor_id;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/tasks"
          className="text-indigo-600 hover:text-indigo-500"
        >
          ← Back to Tasks
        </Link>
        {task.creator && (
          <div className="text-sm text-gray-500">
            Posted by {task.creator.username}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {task.title}
          </h1>

          <div className="flex items-center justify-between mb-6 text-sm text-gray-500">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {new Date(task.created_at).toLocaleDateString()}
            </div>
            <div className="flex items-center font-medium text-indigo-600">
              <DollarSign className="w-4 h-4 mr-1" />
              {task.payment_amount} π
            </div>
          </div>

          <div className="prose max-w-none mb-6">
            <p className="text-gray-700">{task.description}</p>
          </div>

          {task.attachments && task.attachments.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Attachments
              </h3>
              <div className="space-y-2">
                {task.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{attachment.file_name}</span>
                      <span className="text-gray-500">
                        ({Math.round(attachment.file_size / 1024)} KB)
                      </span>
                    </div>
                    <a
                      href={`${supabase.storage.from('attachments').getPublicUrl(attachment.file_path).data.publicUrl}`}
                      download={attachment.file_name}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Download file"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
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
            {task.executor && (
              <div className="text-sm text-gray-500">
                Executor: {task.executor.username}
              </div>
            )}
          </div>
        </div>

        {task && profile && (
          <div className="p-6 border-t">
            <TaskActions
              taskId={task.id}
              status={task.status}
              isCreator={isCreator}
              isExecutor={isExecutor}
              bidAmount={task.payment_amount}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}
      </div>

      {task.status === 'open' && (
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Bids</h2>
          <div className="space-y-4">
            {bids.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-lg shadow-md">
                <p className="text-gray-500">No bids yet</p>
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