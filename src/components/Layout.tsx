import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Briefcase, UserCircle, Plus, LayoutDashboard, MessageSquare, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center px-2 py-2 text-gray-900">
                <Home className="h-6 w-6" />
                <span className="ml-2 font-semibold hidden sm:inline">Gigs for Pi</span>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={toggleMenu}
              className="p-2 rounded-md text-gray-700 md:hidden"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>

            {/* Desktop navigation */}
            <div className="hidden md:flex md:items-center md:space-x-4">
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

        {/* Mobile menu */}
        <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden border-t`}>
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/tasks"
              className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
              onClick={() => setIsMenuOpen(false)}
            >
              <Briefcase className="h-5 w-5" />
              <span className="ml-2">Gigs</span>
            </Link>
            {user && (
              <>
                <Link
                  to="/dashboard"
                  className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <LayoutDashboard className="h-5 w-5" />
                  <span className="ml-2">Dashboard</span>
                </Link>
                <Link
                  to="/messages"
                  className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <MessageSquare className="h-5 w-5" />
                  <span className="ml-2">Messages</span>
                </Link>
                <Link
                  to="/create-task"
                  className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Plus className="h-5 w-5" />
                  <span className="ml-2">Post Gig</span>
                </Link>
              </>
            )}
            <Link
              to="/profile"
              className="flex items-center px-3 py-2 text-gray-700 hover:text-gray-900"
              onClick={() => setIsMenuOpen(false)}
            >
              <UserCircle className="h-5 w-5" />
              <span className="ml-2">Profile</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-16">
        {children}
      </main>
    </div>
  );
}