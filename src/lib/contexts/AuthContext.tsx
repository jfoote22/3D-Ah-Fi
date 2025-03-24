"use client";

import React, { createContext, useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { User } from "firebase/auth";
import { auth } from "../firebase/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

function formatFirebaseError(error: any): string {
  // Extract the error code and message
  let errorCode = error?.code || 'unknown-error';
  let errorMessage = error?.message || 'An unknown error occurred';

  // Format firebase errors to be more user-friendly
  if (errorCode === 'auth/api-key-not-valid') {
    return 'Firebase API key is not valid. Please check your environment variables.';
  } else if (errorCode === 'auth/popup-closed-by-user') {
    return 'Sign-in was cancelled. Please try again.';
  } else if (errorCode === 'auth/popup-blocked') {
    return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
  } else if (errorCode.includes('auth/')) {
    // Remove the auth/ prefix for cleaner messages
    return `Authentication error: ${errorCode.replace('auth/', '')}`;
  }

  return errorMessage;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('AuthProvider initialized, setting up onAuthStateChanged listener');
    
    try {
      // Check if Firebase is properly initialized
      if (!auth) {
        console.error('Firebase auth is not initialized');
        setError('Firebase authentication is not properly initialized');
        setLoading(false);
        return () => {};
      }
      
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        setUser(user);
        setLoading(false);
      }, (error) => {
        console.error('Error in auth state change listener:', error);
        setError(formatFirebaseError(error));
        setLoading(false);
      });

      return () => {
        console.log('Unsubscribing from auth state listener');
        unsubscribe();
      };
    } catch (error) {
      console.error('Failed to set up auth state listener:', error);
      setError(formatFirebaseError(error));
      setLoading(false);
      return () => {};
    }
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      console.log('Attempting Google sign in');
      // Check if Firebase is properly initialized
      if (!auth) {
        throw new Error('Firebase authentication is not properly initialized');
      }
      
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log('Google sign in successful');
    } catch (error) {
      console.error("Error signing in with Google", error);
      const formattedError = formatFirebaseError(error);
      setError(formattedError);
      throw new Error(formattedError);
    }
  };

  const signOutUser = async () => {
    setError(null);
    try {
      console.log('Attempting to sign out');
      // Check if Firebase is properly initialized
      if (!auth) {
        throw new Error('Firebase authentication is not properly initialized');
      }
      
      await firebaseSignOut(auth);
      console.log('Sign out successful');
    } catch (error) {
      console.error("Error signing out", error);
      const formattedError = formatFirebaseError(error);
      setError(formattedError);
      throw new Error(formattedError);
    }
  };

  console.log('AuthProvider rendering, auth state:', { user: !!user, loading, error: !!error });

  return (
    <AuthContext.Provider value={{ user, loading, error, signInWithGoogle, signOut: signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
