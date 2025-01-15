import React, { useState } from 'react';
import { submitTaskCompletion } from '../lib/payments';
import { AlertCircle } from 'lucide-react';

interface TaskSubmissionFormProps {
  taskId: string;
  onSubmit: () => void;
}

export function TaskSubmissionForm({ taskId, onSubmit }: TaskSubmissionFormProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await submitTaskCompletion(taskId, content);
      setContent('');
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit task completion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Submission Details
        </label>
        <textarea
          id="content"
          rows={4}
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Describe your work and provide any relevant links or information..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Work'}
      </button>
    </form>
  );
}