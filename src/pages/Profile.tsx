import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { AuthForm } from '../components/AuthForm';
import { AlertCircle, Copy, Check } from 'lucide-react';
import { createTestPayment } from '../lib/payments';

export function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading, error } = useProfile(user?.id);
  const [copied, setCopied] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handleCopyWallet = async () => {
    if (profile?.wallet_address) {
      try {
        await navigator.clipboard.writeText(profile.wallet_address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy wallet address:', err);
      }
    }
  };

  const handleTestPayment = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    setPaymentSuccess(false);

    try {
      const payment = await createTestPayment();
      console.log('Test payment completed:', payment);
      setPaymentSuccess(true);
      // Reload the page after 2 seconds to show updated wallet address
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error('Test payment failed:', err);
      setPaymentError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setPaymentLoading(false);
    }
  };

  if (!user) {
    return <AuthForm />;
  }

  if (authLoading || profileLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Profile</h2>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
          >
            Sign Out
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="mt-1 text-gray-900">{user.email}</div>
          </div>

          {profile && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Username</label>
                <div className="mt-1 text-gray-900">{profile.username}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Wallet Address</label>
                {profile.wallet_address ? (
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 block p-2 text-sm bg-gray-50 rounded border border-gray-200 font-mono text-gray-800 break-all">
                      {profile.wallet_address}
                    </code>
                    <button
                      onClick={handleCopyWallet}
                      className="p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                      title="Copy wallet address"
                    >
                      {copied ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 text-gray-500 italic">
                    No wallet address available. Complete app setup to link your wallet.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Rating</label>
                <div className="mt-1 text-gray-900">
                  {profile.rating.toFixed(1)} / 5.0
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Completed Tasks</label>
                <div className="mt-1 text-gray-900">{profile.completed_tasks}</div>
              </div>

              {!profile.wallet_address && (
                <div className="pt-4 border-t">
                  <div className="rounded-md bg-yellow-50 p-4 mb-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-yellow-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">
                          App Setup Required
                        </h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <p>
                            To complete the app setup and link your wallet, you need to make a small test payment of 0.1π.
                            This is a one-time process required by Pi Network.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleTestPayment}
                    disabled={paymentLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {paymentLoading ? 'Processing Payment...' : 'Complete App Setup (0.1π)'}
                  </button>

                  {paymentSuccess && (
                    <p className="mt-2 text-sm text-green-600">
                      Payment successful! Reloading page...
                    </p>
                  )}

                  {paymentError && (
                    <p className="mt-2 text-sm text-red-600">{paymentError}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}