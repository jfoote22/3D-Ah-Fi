"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Auth Provider
  const googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('email');
  googleProvider.addScope('profile');

  // Clear error function
  const clearError = () => setError(null);

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      console.log('🚀 Starting Google sign in...');
      console.log('Auth instance:', auth);
      console.log('Google provider:', googleProvider);
      
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Google sign in successful:', result.user.email);
      console.log('User details:', {
        email: result.user.email,
        displayName: result.user.displayName,
        uid: result.user.uid
      });
      
      // User will be set by the onAuthStateChanged listener
    } catch (error: any) {
      console.error('❌ Google sign in failed:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Handle specific error cases
      let errorMessage = 'Failed to sign in with Google';
      if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Sign in was cancelled';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = 'Pop-up was blocked. Please allow pop-ups for this site.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.code === 'auth/unauthorized-domain') {
        errorMessage = 'This domain is not authorized for sign-in.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOutUser = async () => {
    try {
      setError(null);
      console.log('🚪 Signing out...');
      
      await signOut(auth);
      console.log('✅ Sign out successful');
      
      // User will be set to null by the onAuthStateChanged listener
    } catch (error: any) {
      console.error('❌ Sign out failed:', error);
      setError(error.message || 'Failed to sign out');
    }
  };

  // Set up auth state listener
  useEffect(() => {
    console.log('🔧 Setting up auth state listener...');
    console.log('Initial auth state - current user:', auth.currentUser);
    
    const unsubscribe = onAuthStateChanged(auth, 
      (user) => {
        console.log('🔥 Auth state changed:', user ? `User: ${user.email}` : 'No user');
        if (user) {
          console.log('User details:', {
            email: user.email,
            displayName: user.displayName,
            uid: user.uid,
            emailVerified: user.emailVerified
          });
        }
        setUser(user);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('❌ Auth state change error:', error);
        setError(error.message || 'Authentication error');
        setLoading(false);
      }
    );

    // Set a timeout to stop loading if nothing happens
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('⏰ Auth timeout reached, stopping loading...');
        setLoading(false);
      }
    }, 5000); // Increased timeout to 5 seconds

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []); // Removed loading dependency to prevent re-subscription

  const value = {
    user,
    loading,
    error,
    signInWithGoogle,
    signOut: signOutUser,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
