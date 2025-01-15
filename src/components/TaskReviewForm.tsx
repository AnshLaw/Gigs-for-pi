import { useState } from 'react';
import { reviewTaskSubmission } from '../lib/payments';
import { AlertCircle, Check, X } from 'lucide-react';

interface TaskReviewFormProps {
  taskId: string;
  submissionId: string;
  onReview: () => void;
}

export function TaskReviewForm({ taskId, submissionId, onReview }: TaskReviewFormProps) {
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReview = async (approved: boolean) => {
    setLoading(true);
    setError(null);

    try {
      await reviewTaskSubmission(taskId, submissionId, approved, feedback);
      onReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review submission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-md text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="feedback" className="block text-sm font-medium text-gray-700">
          Feedback
        </label>
        <textarea
          id="feedback"
          rows={4}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Provide feedback about the work..."
        />
      </div>

      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => handleReview(true)}
          disabled={loading}
          className="flex-1 flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          Approve & Release Payment
        </button>
        <button
          type="button"
          onClick={() => handleReview(false)}
          disabled={loading}
          className="flex-1 flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Reject
        </button>
      </div>
    </div>
  );
}