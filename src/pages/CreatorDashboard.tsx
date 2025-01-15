import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { Clock, DollarSign, Users, AlertCircle, Trash2 } from 'lucide-react';
import type { Task } from '../lib/types';

export function CreatorDashboard() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchCreatorTasks();
    }
  }, [profile?.id]);

  const fetchCreatorTasks = async () => {
    if (!profile?.id) return;

    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          *,
          creator:profiles!tasks_creator_id_fkey (
            username,
            rating
          ),
          bids (
            id
          )
        `)
        .eq('creator_id', profile.id)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load gigs');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this gig? This action cannot be undone.')) {
      return;
    }

    setDeletingId(taskId);
    setError(null);

    try {
      // Delete all bids first
      const { error: bidsError } = await supabase
        .from('bids')
        .delete()
        .eq('task_id', taskId);

      if (bidsError) throw bidsError;

      // Then delete the task
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('status', 'open'); // Only allow deleting open tasks

      if (taskError) throw taskError;

      // Refresh the task list
      await fetchCreatorTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete gig');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  if (loading || profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-600">Loading your gigs...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Gigs</h1>
        <Link
          to="/create-task"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Post a New Gig
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 text-red-500 p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <div key={task.id} className="relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-2">
                <Link to={`/tasks/${task.id}`} className="block">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {task.title}
                  </h3>
                </Link>
                {task.status === 'open' && (
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={deletingId === task.id}
                    className="p-1.5 text-red-600 hover:text-red-700 rounded-full hover:bg-red-50"
                    title="Delete gig"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Link to={`/tasks/${task.id}`} className="block">
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {task.description}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(task.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center font-medium text-indigo-600">
                    <DollarSign className="w-4 h-4 mr-1" />
                    {task.payment_amount} π
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
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
                  <span className="text-sm text-gray-500">
                    {task.bids?.length || 0} bids
                  </span>
                </div>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No gigs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first gig.
          </p>
          <div className="mt-6">
            <Link
              to="/create-task"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Create a Gig
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}