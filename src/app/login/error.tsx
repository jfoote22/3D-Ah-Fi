'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Login page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
      <div className="relative z-10 max-w-md w-full bg-slate-800/90 backdrop-blur-xl rounded-lg border border-slate-700 shadow-xl p-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-red-400 mb-4">Error</h1>
          <h2 className="text-2xl font-bold gradient-text mb-4">Something went wrong</h2>
          <p className="text-slate-400 mb-6">
            An error occurred while loading the login page.
          </p>
          
          <div className="mb-6 p-3 bg-slate-900 rounded-lg border border-slate-700">
            <p className="text-red-400 text-sm font-mono break-all">
              {error.message || "Unknown error occurred"}
            </p>
            {error.digest && (
              <p className="text-slate-500 text-xs mt-2 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={reset}
              className="bg-gradient-to-br from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all shadow-md"
            >
              Try again
            </button>
            <Link
              href="/"
              className="bg-slate-700 text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-600 transition-all"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
      
      {/* Background decorative elements */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
    </div>
  );
} 