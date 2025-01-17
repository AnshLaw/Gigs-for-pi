import { useAuth } from '../lib/auth';
import { AlertCircle } from 'lucide-react';

export function AuthForm() {
  const { signInWithPi, error, loading } = useAuth();

  const handleSignIn = async () => {
    await signInWithPi();
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-6 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="text-2xl font-bold text-center text-gray-900">
            Sign in with Pi Network
          </h2>
          <p className="mt-2 text-sm text-center text-gray-600">
            Connect your Pi Network account to access the marketplace
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 p-3 rounded-md text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Connecting to Pi Network...
            </>
          ) : (
            'Connect with Pi'
          )}
        </button>
      </div>
    </div>
  );
}