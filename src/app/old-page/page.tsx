'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from "next/link";
import AIWorkflowInterface from '../components/AIWorkflowInterface';
import Header from '../components/Header';

export default function OldPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [debugMessage, setDebugMessage] = useState<string>('');

  useEffect(() => {
    // Debug information
    console.log('Old page - Auth state:', { user, loading });
    setDebugMessage(`Auth state: ${loading ? 'Loading' : 'Ready'}, User: ${user ? 'Authenticated' : 'Not authenticated'}`);
    
    // If not loading and user is not authenticated, redirect to login page
    if (!loading && !user) {
      console.log('User not authenticated, redirecting to login page');
      router.push('/login');
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-blue-400 font-medium">Loading...</p>
          <p className="text-slate-500 text-sm mt-2">Checking authentication status</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, don't render the page content
  // This is a backup check in case the redirect in useEffect hasn't happened yet
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="text-red-400 font-medium mb-4">Not authenticated</div>
          <Link href="/login" className="btn-gradient text-white font-medium py-2 px-4 rounded-lg">
            Go to Login
          </Link>
          {process.env.NODE_ENV !== 'production' && (
            <p className="text-slate-500 text-xs mt-4 max-w-md font-mono">{debugMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      {process.env.NODE_ENV !== 'production' && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900/80 p-2 rounded border border-slate-700 text-xs font-mono text-slate-400 max-w-xs">
          {debugMessage}
        </div>
      )}
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <header className="text-center mb-12 relative">
            {/* Background decorative elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
            
            <h1 className="text-5xl md:text-6xl font-bold gradient-text mb-2 tracking-tight">
              3D-Ah-Fi (Old Version)
            </h1>
            <p className="mt-3 text-slate-400 max-w-2xl mx-auto">
              Create stunning images and 3D models powered by advanced AI models
            </p>
            
            {/* Tech badges */}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              <span className="px-3 py-1 text-xs bg-slate-800 text-blue-400 border border-blue-900/50 rounded">
                Google/Imagen-4
              </span>
              <span className="px-3 py-1 text-xs bg-slate-800 text-purple-400 border border-purple-900/50 rounded">
                Claude AI
              </span>
              <span className="px-3 py-1 text-xs bg-slate-800 text-pink-400 border border-pink-900/50 rounded">
                Replicate API
              </span>
            </div>
          </header>
          
          <AIWorkflowInterface />
          
          <footer className="mt-16 text-center text-slate-500 text-sm border-t border-slate-800 pt-8">
            <p>© {new Date().getFullYear()} 3D-Ah-Fi • Next-generation AI content creation</p>
            <p className="mt-2">
              <a href="https://replicate.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                Replicate API
              </a>
              {' • '}
              <a href="https://anthropic.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 transition-colors">
                Anthropic Claude
              </a>
              {' • '}
              <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 transition-colors">
                Next.js
              </a>
            </p>
          </footer>
        </div>
      </main>
    </>
  );
} 