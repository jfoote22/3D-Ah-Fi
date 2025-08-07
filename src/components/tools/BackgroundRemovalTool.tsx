'use client'

import React, { useState, useCallback } from 'react'
import { Scissors, Upload, Download, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/utils/logger'
import { useWorkflowStore } from '@/lib/stores/workflow-store'

interface BackgroundRemovalToolProps {
  imageUrl?: string
  imageId?: string // Add image ID for workflow store updates
  onRemovalComplete?: (resultUrl: string) => void
  className?: string
}

export function BackgroundRemovalTool({ 
  imageUrl, 
  imageId,
  onRemovalComplete, 
  className 
}: BackgroundRemovalToolProps) {
  const { updateImageBackgroundRemoved } = useWorkflowStore()
  const [inputImage, setInputImage] = useState<string>(imageUrl || '')
  const [inputFile, setInputFile] = useState<File | null>(null)
  const [resultImage, setResultImage] = useState<string>('')
  const [isRemoving, setIsRemoving] = useState(false)
  const [error, setError] = useState('')
  const [credits, setCredits] = useState<number | null>(null)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Image file too large. Please select an image under 10MB.')
      return
    }

    setInputFile(file)
    setError('')

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setInputImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      // Directly handle the dropped file instead of creating synthetic event
      if (file.size > 10 * 1024 * 1024) {
        setError('Image file too large. Please select an image under 10MB.')
        return
      }

      setInputFile(file)
      setError('')

      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setInputImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }, [])

  const handleRemoveBackground = async () => {
    if (!inputImage) return

    setIsRemoving(true)
    setError('')
    
    try {
      logger.info('Starting background removal')

      const formData = new FormData()
      
      if (inputFile) {
        formData.append('image_file', inputFile)
      } else if (inputImage.startsWith('http') || inputImage.startsWith('data:')) {
        // Convert URL to file
        const response = await fetch(inputImage)
        const blob = await response.blob()
        const file = new File([blob], 'image.png', { type: 'image/png' })
        formData.append('image_file', file)
      } else {
        throw new Error('No valid image source available')
      }

      const response = await fetch('/api/clipdrop/remove-background', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to remove background')
      }

      // Check if the response is an image
      const contentType = response.headers.get('content-type')
      if (contentType?.startsWith('image/')) {
        // Convert blob to data URL
        const blob = await response.blob()
        const reader = new FileReader()
        reader.onload = () => {
          const resultUrl = reader.result as string
          setResultImage(resultUrl)
          
          // Update workflow store if imageId is provided
          if (imageId) {
            updateImageBackgroundRemoved(imageId, resultUrl)
          }
          
          if (onRemovalComplete) {
            onRemovalComplete(resultUrl)
          }
          
          logger.info('Background removal successful')
        }
        reader.readAsDataURL(blob)
      } else {
        // Handle JSON response with credits info
        const data = await response.json()
        if (data.resultUrl) {
          setResultImage(data.resultUrl)
          if (onRemovalComplete) {
            onRemovalComplete(data.resultUrl)
          }
        }
        if (data.credits !== undefined) {
          setCredits(data.credits)
        }
      }

    } catch (error) {
      logger.error('Background removal failed', error)
      setError(error instanceof Error ? error.message : 'Background removal failed')
    } finally {
      setIsRemoving(false)
    }
  }

  const handleDownload = () => {
    if (!resultImage) return

    const link = document.createElement('a')
    link.href = resultImage
    link.download = 'background-removed.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleReset = () => {
    setInputImage(imageUrl || '')
    setInputFile(null)
    setResultImage('')
    setError('')
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
                <Scissors className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Remove Background</h3>
                <p className="text-sm text-muted-foreground">
                  Create transparent PNG images
                </p>
              </div>
            </div>
            {credits !== null && (
              <Badge variant="outline">
                {credits} credits remaining
              </Badge>
            )}
          </div>

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Input Section */}
          {!inputImage && (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/40 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Upload an image</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop or click to select an image file
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <Button asChild>
                <label htmlFor="image-upload" className="cursor-pointer">
                  Select Image
                </label>
              </Button>
            </div>
          )}

          {/* Preview and Result */}
          {inputImage && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Original Image */}
                <div>
                  <h4 className="font-medium mb-2">Original</h4>
                  <div className="relative aspect-square rounded-lg overflow-hidden border">
                    <Image
                      src={inputImage}
                      alt="Original image"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>

                {/* Result Image */}
                <div>
                  <h4 className="font-medium mb-2">Background Removed</h4>
                  <div className="relative aspect-square rounded-lg overflow-hidden border bg-checkered">
                    {resultImage ? (
                      <Image
                        src={resultImage}
                        alt="Background removed"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-muted/20">
                        <p className="text-sm text-muted-foreground">
                          Result will appear here
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handleReset}
                >
                  Change Image
                </Button>

                <div className="flex items-center gap-2">
                  {resultImage && (
                    <Button
                      variant="outline"
                      onClick={handleDownload}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleRemoveBackground}
                    disabled={isRemoving}
                  >
                    {isRemoving ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Removing...
                      </>
                    ) : (
                      <>
                        <Scissors className="w-4 h-4 mr-2" />
                        Remove Background
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Works best with images that have clear subjects and distinct backgrounds.
              Supports JPG, PNG, and WebP formats up to 10MB.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Add checkered background CSS
const style = `
.bg-checkered {
  background-image: 
    linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%), 
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
`

if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = style
  document.head.appendChild(styleElement)
}