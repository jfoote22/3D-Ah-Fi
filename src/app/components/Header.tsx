'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';

export default function Header() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpen(false);
      setProfileMenuOpen(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Prevent event propagation to avoid closing menu when clicking on menu items
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Show loading state
  if (loading) {
    return (
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl font-bold gradient-text">3D-Ah-Fi</span>
            </div>
            <div className="text-slate-400">Loading...</div>
          </div>
        </div>
      </header>
    );
  }

  // If user is not authenticated, show minimal header
  if (!user) {
    return (
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <span className="text-2xl font-bold gradient-text">3D-Ah-Fi</span>
            </div>
            <div className="text-slate-400">Not authenticated</div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-lg border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center py-4">
          {/* Logo and site name */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold gradient-text">3D-Ah-Fi</span>
            </Link>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              href="/" 
              className={`text-sm font-medium transition-colors ${
                pathname === '/' 
                  ? 'text-blue-400' 
                  : 'text-slate-300 hover:text-blue-400'
              }`}
            >
              Home
            </Link>
            <Link 
              href="/my-models" 
              className={`text-sm font-medium transition-colors ${
                pathname === '/my-models' 
                  ? 'text-blue-400' 
                  : 'text-slate-300 hover:text-blue-400'
              }`}
            >
              My Models
            </Link>
          </nav>

          {/* User profile */}
          <div className="flex items-center">
            <div className="relative" onClick={stopPropagation}>
              <button
                className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-lg p-1 pr-3 hover:bg-slate-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfileMenuOpen(!profileMenuOpen);
                }}
              >
                <div className="w-8 h-8 rounded-md overflow-hidden bg-blue-900/50 flex items-center justify-center">
                  {user?.photoURL ? (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium text-white">
                      {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-300 max-w-[100px] truncate">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
              </button>

              {/* Profile dropdown menu */}
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <p className="text-sm text-slate-300 truncate">{user?.email}</p>
                  </div>
                  <div>
                    <Link 
                      href="/my-models"
                      className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      My Models
                    </Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors"
                      onClick={handleSignOut}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden ml-2">
              <button
                className="p-2 rounded-md text-slate-400 hover:text-white focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {menuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-800 py-2" onClick={stopPropagation}>
            <Link
              href="/"
              className="block px-4 py-2 text-base font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              href="/my-models"
              className="block px-4 py-2 text-base font-medium text-slate-300 hover:bg-slate-800 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              My Models
            </Link>
            <button
              className="block w-full text-left px-4 py-2 text-base font-medium text-red-400 hover:bg-slate-800 transition-colors"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
} 