'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface WorkflowCardProps {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  status?: 'idle' | 'loading' | 'success' | 'error'
  progress?: number
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
  resultCount?: number
}

export function WorkflowCard({
  title,
  description,
  icon: Icon,
  status = 'idle',
  progress,
  children,
  className,
  actions,
  resultCount
}: WorkflowCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'bg-blue-500/10 border-blue-500/20'
      case 'success':
        return 'bg-green-500/10 border-green-500/20'
      case 'error':
        return 'bg-red-500/10 border-red-500/20'
      default:
        return 'bg-muted/50 border-border'
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case 'loading':
        return <Badge variant="default" className="animate-pulse">Processing</Badge>
      case 'success':
        return <Badge variant="success">Complete</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return null
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Card className={cn(
        'relative overflow-hidden transition-all duration-300',
        getStatusColor(),
        status === 'loading' && 'shadow-lg',
        className
      )}>
        {/* Progress bar for loading state */}
        {status === 'loading' && progress !== undefined && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg',
                  status === 'loading' && 'bg-primary/10',
                  status === 'success' && 'bg-green-500/10',
                  status === 'error' && 'bg-red-500/10',
                  status === 'idle' && 'bg-muted'
                )}>
                  <Icon className={cn(
                    'w-5 h-5',
                    status === 'loading' && 'text-primary animate-pulse',
                    status === 'success' && 'text-green-500',
                    status === 'error' && 'text-red-500',
                    status === 'idle' && 'text-muted-foreground'
                  )} />
                </div>
              )}
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                {description && (
                  <CardDescription className="mt-1">{description}</CardDescription>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {resultCount !== undefined && resultCount > 0 && (
                <Badge variant="secondary">
                  {resultCount} result{resultCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {getStatusBadge()}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {children}
          
          {actions && (
            <div className="flex items-center justify-between pt-4 border-t border-border">
              {actions}
            </div>
          )}
        </CardContent>

        {/* Loading overlay */}
        {status === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Processing...</span>
            </div>
          </motion.div>
        )}
      </Card>
    </motion.div>
  )
}