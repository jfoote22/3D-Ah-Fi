'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';

export default function Login() {
  const { user, loading, error: authContextError, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [firebaseConfigInfo, setFirebaseConfigInfo] = useState<string>('');

  useEffect(() => {
    // Check if Firebase configuration environment variables are set
    const envVars = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'Set' : 'Not set',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'Set' : 'Not set',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Not set',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'Set' : 'Not set',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? 'Set' : 'Not set',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'Set' : 'Not set',
    };
    
    setFirebaseConfigInfo(`Firebase env vars: ${JSON.stringify(envVars)}`);
  }, []);

  useEffect(() => {
    // Debug info
    console.log('Login page - Auth state:', { user, loading, authContextError });
    setDebugInfo(`Auth state: ${loading ? 'Loading' : 'Ready'}, User: ${user ? 'Authenticated' : 'Not authenticated'}, Auth error: ${authContextError || 'None'}`);
    
    // If there's an error in AuthContext, display it on the page
    if (authContextError) {
      setAuthError(authContextError);
    }
    
    // If user is authenticated, redirect to home page
    if (user && !loading) {
      console.log('User is authenticated, redirecting to home page');
      router.push('/');
    }
  }, [user, loading, router, authContextError]);

  const handleGoogleSignIn = async () => {
    try {
      setAuthError(null);
      console.log('Attempting Google sign in...');
      await signInWithGoogle();
      console.log('Google sign in completed');
      // No need to redirect here, the useEffect will handle it
    } catch (error) {
      console.error('Error signing in with Google:', error);
      setAuthError(`Failed to sign in with Google: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
      
      <div className="w-full max-w-md">
        <div className="bg-slate-800/90 backdrop-blur-xl rounded-lg border border-slate-700 shadow-xl p-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold gradient-text mb-2">3D-Ah-Fi</h1>
            <p className="text-slate-400">Sign in to create stunning AI-generated images and 3D models</p>
          </div>
          
          {authError && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
              <p className="text-red-400 text-sm">{authError}</p>
            </div>
          )}
          
          {/* Debug info - only in development */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="mb-6 p-4 bg-slate-900/60 border border-slate-700 rounded-lg">
              <p className="text-slate-400 text-xs font-mono">{debugInfo}</p>
              {firebaseConfigInfo && (
                <p className="text-slate-400 text-xs font-mono mt-2">{firebaseConfigInfo}</p>
              )}
            </div>
          )}
          
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-slate-900 border border-slate-700 text-white py-3 px-4 rounded-lg hover:bg-slate-800 transition-colors shadow-md"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>
          
          <div className="mt-8 text-center text-sm">
            <p className="text-slate-500">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <div className="flex justify-center space-x-3">
            <span className="px-3 py-1 text-xs bg-slate-800 text-blue-400 border border-blue-900/50 rounded">
              Stable Diffusion
            </span>
            <span className="px-3 py-1 text-xs bg-slate-800 text-purple-400 border border-purple-900/50 rounded">
              Hunyuan3D-2
            </span>
          </div>
        </div>
      </div>
    </main>
  );
} 