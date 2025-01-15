import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { Clock, DollarSign, Search, SlidersHorizontal, AlertCircle } from 'lucide-react';
import type { Task } from '../lib/types';

interface TaskWithBids extends Task {
  bids: { id: string }[];
}

export function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskWithBids[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minPayment: '',
    maxPayment: '',
    status: '',
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
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
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      let filteredTasks = data || [];

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
          task.title.toLowerCase().includes(query) || 
          task.description.toLowerCase().includes(query)
        );
      }

      // Apply payment range filters
      if (filters.minPayment) {
        filteredTasks = filteredTasks.filter(task => 
          task.payment_amount >= parseFloat(filters.minPayment)
        );
      }
      if (filters.maxPayment) {
        filteredTasks = filteredTasks.filter(task => 
          task.payment_amount <= parseFloat(filters.maxPayment)
        );
      }

      // Apply status filter
      if (filters.status) {
        filteredTasks = filteredTasks.filter(task => 
          task.status === filters.status
        );
      }

      setTasks(filteredTasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load gigs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [searchQuery, filters.minPayment, filters.maxPayment, filters.status]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-600">Loading gigs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchTasks}
          className="mt-4 text-indigo-600 hover:text-indigo-500"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Available Gigs</h1>
        {user && (
          <Link
            to="/create-task"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            Post a Gig
          </Link>
        )}
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search gigs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <SlidersHorizontal className="h-5 w-5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="p-4 bg-white rounded-md shadow-sm border border-gray-200 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="minPayment" className="block text-sm font-medium text-gray-700">
                  Min Payment (π)
                </label>
                <input
                  type="number"
                  id="minPayment"
                  value={filters.minPayment}
                  onChange={(e) => setFilters({ ...filters, minPayment: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="maxPayment" className="block text-sm font-medium text-gray-700">
                  Max Payment (π)
                </label>
                <input
                  type="number"
                  id="maxPayment"
                  value={filters.maxPayment}
                  onChange={(e) => setFilters({ ...filters, maxPayment: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            to={`/tasks/${task.id}`}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {task.title}
              </h3>
              <p className="text-gray-600 mb-4 line-clamp-2">{task.description}</p>
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
            </div>
          </Link>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No gigs available at the moment.</p>
          {user && (
            <Link
              to="/create-task"
              className="text-indigo-600 hover:text-indigo-500 font-medium mt-2 inline-block"
            >
              Be the first to post a gig
            </Link>
          )}
        </div>
      )}
    </div>
  );
}