'use client'

import React from 'react'
import { WorkflowProvider } from '@/components/workflow/WorkflowProvider'
import { WorkflowNavigation } from '@/components/workflow/WorkflowNavigation'
import { WorkflowSteps } from '@/components/workflow/WorkflowSteps'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { User, LogOut, RefreshCw } from 'lucide-react'
import { useWorkflowStore } from '@/lib/stores/workflow-store'

interface ModernLayoutProps {
  children?: React.ReactNode
}

export function ModernLayout({ children }: ModernLayoutProps) {
  const { user, signOut, loading } = useAuth()
  const resetWorkflow = useWorkflowStore(state => state.resetWorkflow)

  // Show loading state while authentication is being determined
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-primary font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  const handleReset = () => {
    const confirmed = window.confirm('Start over and clear your current progress?')
    if (confirmed) {
      resetWorkflow()
      // Optionally, scroll to top to emphasize reset
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <WorkflowProvider>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold gradient-text">3D-Ah-Fi</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Creative Studio</p>
              </div>
              <div className="flex items-center gap-4">
                <nav className="hidden md:flex items-center space-x-6">
                  <Link 
                    href="/my-creations" 
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    My Creations
                  </Link>
                </nav>
                {/* Reset workflow button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </Button>
                {user && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{user.email}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={signOut}
                      className="gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Workflow Navigation */}
        <section className="border-b border-border bg-muted/30">
          <div className="container mx-auto px-4 py-8">
            <WorkflowNavigation />
          </div>
        </section>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <WorkflowSteps />
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border bg-muted/30 mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} 3D-Ah-Fi • AI-Powered Creative Platform
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors">About</a>
                <a href="#" className="hover:text-foreground transition-colors">Help</a>
                <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </WorkflowProvider>
  )
}