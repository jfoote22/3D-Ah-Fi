'use client'

import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthTest() {
  const { user, loading, error, signInWithGoogle, signOut, clearError } = useAuth()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
          <CardDescription>
            Test the Google authentication functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Status:</p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${loading ? 'bg-yellow-500' : user ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm">
                {loading ? 'Loading...' : user ? 'Authenticated' : 'Not authenticated'}
              </span>
            </div>
          </div>

          {user && (
            <div className="space-y-2">
              <p className="text-sm font-medium">User Info:</p>
              <div className="text-sm text-muted-foreground">
                <p>Email: {user.email}</p>
                <p>UID: {user.uid}</p>
                <p>Display Name: {user.displayName || 'Not set'}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Error:</p>
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                {error}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {!user ? (
              <Button onClick={signInWithGoogle} disabled={loading} className="flex-1">
                {loading ? 'Signing in...' : 'Sign in with Google'}
              </Button>
            ) : (
              <Button onClick={signOut} variant="outline" className="flex-1">
                Sign Out
              </Button>
            )}
            
            {error && (
              <Button onClick={clearError} variant="outline" size="sm">
                Clear Error
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Firebase Config:</p>
            <p>Project ID: test2-21fd5</p>
            <p>Auth Domain: test2-21fd5.firebaseapp.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 