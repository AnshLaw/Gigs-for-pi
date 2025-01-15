import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Briefcase, UserCircle, Plus, LayoutDashboard, MessageSquare } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center px-2 py-2 text-gray-900">
                <Home className="h-6 w-6" />
                <span className="ml-2 font-semibold">Gigs for Pi</span>
              </Link>
            </div>
            <div className="flex space-x-4">
              <Link
                to="/tasks"
                className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
              >
                <Briefcase className="h-5 w-5" />
                <span className="ml-2">Gigs</span>
              </Link>
              {user && (
                <>
                  <Link
                    to="/dashboard"
                    className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="ml-2">Dashboard</span>
                  </Link>
                  <Link
                    to="/messages"
                    className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
                  >
                    <MessageSquare className="h-5 w-5" />
                    <span className="ml-2">Messages</span>
                  </Link>
                  <Link
                    to="/create-task"
                    className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="ml-2">Post Gig</span>
                  </Link>
                </>
              )}
              <Link
                to="/profile"
                className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
              >
                <UserCircle className="h-5 w-5" />
                <span className="ml-2">Profile</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}