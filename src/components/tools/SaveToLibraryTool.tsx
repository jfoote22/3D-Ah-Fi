'use client'

import React, { useState } from 'react'
import { Save, Cloud, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/hooks/useAuth'
import { useWorkflowStore } from '@/lib/stores/workflow-store'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/utils/logger'

interface SaveToLibraryToolProps {
  className?: string
}

export function SaveToLibraryTool({ className }: SaveToLibraryToolProps) {
  const { user } = useAuth()
  const { generatedImages, generatedModels } = useWorkflowStore()
  
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const handleSaveProject = async () => {
    if (!user) {
      setError('Please sign in to save your project')
      return
    }

    if (!projectName.trim()) {
      setError('Please enter a project name')
      return
    }

    if (generatedImages.length === 0 && generatedModels.length === 0) {
      setError('No content to save. Please generate some images or models first.')
      return
    }

    setSaving(true)
    setError('')

    try {
      logger.info('Saving project to Firebase', { 
        projectName,
        imageCount: generatedImages.length,
        modelCount: generatedModels.length
      })

      const projectData = {
        name: projectName.trim(),
        description: projectDescription.trim(),
        images: generatedImages,
        models: generatedModels,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const response = await fetch('/api/save-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save project')
      }

      const result = await response.json()
      
      logger.info('Project saved successfully', { projectId: result.id })

      setSaved(true)
      setTimeout(() => setSaved(false), 3000) // Reset success state after 3 seconds

    } catch (error) {
      logger.error('Failed to save project', error)
      setError(error instanceof Error ? error.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setProjectName('')
    setProjectDescription('')
    setError('')
    setSaved(false)
  }

  const totalItems = generatedImages.length + generatedModels.length

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-500/10">
                <Save className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">Save to Library</h3>
                <p className="text-sm text-muted-foreground">
                  Save your creations to your personal library
                </p>
              </div>
            </div>
            {totalItems > 0 && (
              <Badge variant="outline">
                {totalItems} item{totalItems !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* User status */}
          {!user ? (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <Cloud className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Sign in to save your projects to the cloud
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Success message */}
              {saved && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Project saved successfully!
                  </p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* Project details form */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Project Name *
                  </label>
                  <Input
                    placeholder="Give your project a memorable name..."
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Description (Optional)
                  </label>
                  <Textarea
                    placeholder="Describe your project, creative process, or inspiration..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              {/* Content summary */}
              {totalItems > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Content to Save:</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {generatedImages.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Generated Images</span>
                        <Badge variant="secondary" className="text-xs">
                          {generatedImages.length}
                        </Badge>
                      </div>
                    )}
                    {generatedModels.length > 0 && (
                      <div className="flex items-center justify-between">
                        <span>3D Models</span>
                        <Badge variant="secondary" className="text-xs">
                          {generatedModels.length}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2">
                {saved && (
                  <Button
                    variant="outline"
                    onClick={resetForm}
                  >
                    Save Another Project
                  </Button>
                )}
                
                <Button
                  onClick={handleSaveProject}
                  disabled={saving || !projectName.trim() || totalItems === 0}
                  className="flex-1 gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save to Library
                    </>
                  )}
                </Button>
              </div>

              {totalItems === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Generate some images or 3D models first to save your project
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}