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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('AuthProvider initialized, setting up onAuthStateChanged listener');
    
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        setUser(user);
        setLoading(false);
      }, (error) => {
        console.error('Error in auth state change listener:', error);
        setError(`Authentication error: ${error.message}`);
        setLoading(false);
      });

      return () => {
        console.log('Unsubscribing from auth state listener');
        unsubscribe();
      };
    } catch (error) {
      console.error('Failed to set up auth state listener:', error);
      setError(`Failed to initialize authentication: ${error instanceof Error ? error.message : String(error)}`);
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      console.log('Attempting Google sign in');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log('Google sign in successful');
    } catch (error) {
      console.error("Error signing in with Google", error);
      setError(`Google sign in failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };

  const signOutUser = async () => {
    setError(null);
    try {
      console.log('Attempting to sign out');
      await firebaseSignOut(auth);
      console.log('Sign out successful');
    } catch (error) {
      console.error("Error signing out", error);
      setError(`Sign out failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
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
