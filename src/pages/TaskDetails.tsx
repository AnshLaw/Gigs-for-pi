import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { Clock, DollarSign, Users, AlertCircle, Check, X, Download, Paperclip } from 'lucide-react';
import { TaskActions } from '../components/TaskActions';
import type { Task, Bid, TaskAttachment } from '../lib/types';


export function TaskDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const [task, setTask] = useState<Task | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [updatingBidId, setUpdatingBidId] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchTaskAndBids();
      fetchAttachments();
    }
  }, [id]);

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

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAttachments(data || []);
    } catch (err) {
      console.error('Error fetching attachments:', err);
      setError('Failed to load attachments');
    }
  };

  const handleDownload = async (attachment: TaskAttachment) => {
    try {
      setDownloadingFile(attachment.id);
      setError(null);

      // Get the signed URL for the file
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('attachments')
        .createSignedUrl(attachment.file_path, 60); // URL valid for 60 seconds

      if (signedUrlError) throw signedUrlError;
      if (!signedUrlData?.signedUrl) throw new Error('Failed to generate download URL');

      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = signedUrlData.signedUrl;
      link.download = attachment.file_name; // Set the download filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file. Please try again.');
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleBidAction = async (bidId: string, action: 'accept' | 'reject') => {
    if (!task || !profile) return;

    setUpdatingBidId(bidId);
    setError(null);

    try {
      const bid = bids.find((b) => b.id === bidId);
      if (!bid) throw new Error('Bid not found');

      if (action === 'accept') {
        const { error: updateError } = await supabase.rpc('accept_bid', {
          p_task_id: task.id,
          p_bid_id: bidId,
          p_executor_id: bid.bidder_id
        });

        if (updateError) throw updateError;
      } else {
        const { error: bidError } = await supabase
          .from('bids')
          .update({ status: 'rejected' })
          .eq('id', bidId);

        if (bidError) throw bidError;
      }

      fetchTaskAndBids();
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

  const handleStatusChange = () => {
    fetchTaskAndBids();
  };


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

          {attachments.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Attachments
              </h2>
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-900">{attachment.file_name}</span>
                      <span className="text-xs text-gray-500">
                        ({Math.round(attachment.file_size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      onClick={() => handleDownload(attachment)}
                      disabled={downloadingFile === attachment.id}
                      className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full disabled:opacity-50"
                    >
                      {downloadingFile === attachment.id ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

        {task && profile && (
          <div className="p-6 border-t">
            <TaskActions
              taskId={task.id}
              status={task.status}
              isCreator={task.creator_id === profile.id}
              isExecutor={task.executor_id === profile.id}
              bidAmount={task.payment_amount}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}

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
                        onClick={() => handleBidAction(bid.id, 'accept')}
                        disabled={updatingBidId === bid.id}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Accept
                      </button>
                      <button
                        onClick={() => handleBidAction(bid.id, 'reject')}
                        disabled={updatingBidId === bid.id}
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
    </div>
  );
}