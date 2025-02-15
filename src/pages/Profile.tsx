import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { AuthForm } from '../components/AuthForm';
import { PaymentButton } from '../components/PaymentButton';
import { AlertCircle, Copy, Check } from 'lucide-react';

export function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading, error } = useProfile(user?.id);
  const [copied, setCopied] = useState(false);
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

  const handlePaymentSuccess = (result: any) => {
    console.log('Payment successful:', result);
    setPaymentSuccess(true);
    setTimeout(() => setPaymentSuccess(false), 3000);
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
                    No wallet address available
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

              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Test Payment</h3>
                <div className="flex items-center gap-4">
                  <PaymentButton amount={1} onSuccess={handlePaymentSuccess} />
                  {paymentSuccess && (
                    <span className="text-sm text-green-600 animate-fade-in">
                      Payment successful!
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}