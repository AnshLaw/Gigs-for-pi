import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function Home() {
  return (
    <div className="relative">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Welcome to Gigs for Pi
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Connect with the Pi community to find gigs, offer services, and earn Pi coins.
          Our secure platform makes it easy to post gigs, place bids, and complete transactions.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            to="/tasks"
            className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Browse Gigs
          </Link>
          <Link
            to="/create-task"
            className="text-sm font-semibold leading-6 text-gray-900 flex items-center"
          >
            Post a Gig <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}