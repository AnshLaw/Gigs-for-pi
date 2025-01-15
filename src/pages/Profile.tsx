import React from 'react';
import { useAuth } from '../lib/auth';
import { useProfile } from '../lib/hooks';
import { AuthForm } from '../components/AuthForm';
import { AlertCircle } from 'lucide-react';

export function Profile() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, loading: profileLoading, error } = useProfile(user?.id);

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

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="mt-1 text-gray-900">{user.email}</div>
          </div>
          {profile && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <div className="mt-1 text-gray-900">{profile.username}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}