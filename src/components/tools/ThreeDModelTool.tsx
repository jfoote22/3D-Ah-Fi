'use client'

import React, { useState } from 'react'
import { Box, Download, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { logger, performanceLogger } from '@/lib/utils/logger'
import { generateId } from '@/lib/utils'
import { useWorkflowStore } from '@/lib/stores/workflow-store'

// Import the existing ModelViewer component
import ModelViewer from '@/app/components/ModelViewer'

interface ThreeDModelToolProps {
  imageUrl?: string
  prompt?: string
  backgroundRemovedImageUrl?: string // Add optional background removed image
  onModelGenerated?: (modelUrl: string) => void
  className?: string
}

const qualityPresets = [
  {
    value: 'fast',
    label: 'Fast',
    description: 'Quick generation, lower quality',
    steps: 15,
    targetFaces: 2000,
    octreeResolution: 64
  },
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Good balance of speed and quality',
    steps: 20,
    targetFaces: 5000,
    octreeResolution: 128
  },
  {
    value: 'high',
    label: 'High Quality',
    description: 'Best quality, slower generation',
    steps: 30,
    targetFaces: 10000,
    octreeResolution: 256
  }
]

export function ThreeDModelTool({ 
  imageUrl, 
  prompt, 
  backgroundRemovedImageUrl,
  onModelGenerated, 
  className 
}: ThreeDModelToolProps) {
  const { addGeneratedModel } = useWorkflowStore()
  
  const [modelUrl, setModelUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [generationTime, setGenerationTime] = useState<number | null>(null)
  const [qualityPreset, setQualityPreset] = useState('balanced')
  const [customPrompt, setCustomPrompt] = useState(prompt || '')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [useBackgroundRemovedImage, setUseBackgroundRemovedImage] = useState(false)

  const handleGenerate3D = async () => {
    const sourceImageUrl = useBackgroundRemovedImage && backgroundRemovedImageUrl ? backgroundRemovedImageUrl : imageUrl
    if (!sourceImageUrl) return

    const requestId = generateId()
    performanceLogger.start(`3d-generation-${requestId}`)
    setIsGenerating(true)
    setError('')
    setGenerationTime(null)

    try {
      const imageType = useBackgroundRemovedImage ? 'background-removed' : 'original'
      logger.info('Starting 3D model generation', { 
        imageUrl: sourceImageUrl.substring(0, 50) + '...',
        imageType 
      })

      const selectedPreset = qualityPresets.find(p => p.value === qualityPreset) || qualityPresets[1]

      const requestBody = {
        imageUrl: sourceImageUrl,
        prompt: customPrompt || prompt || 'A detailed 3D model',
        // Use preset values for optimized generation
        steps: selectedPreset.steps,
        targetFaceNum: selectedPreset.targetFaces,
        octreeResolution: selectedPreset.octreeResolution,
      }

      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate 3D model')
      }

      const data = await response.json()
      
      logger.info('3D model generation successful', { 
        generationTime: data.generationTime 
      })

      setModelUrl(data.modelUrl)
      setGenerationTime(parseFloat(data.generationTime))

      // Add to workflow store
      const newModel = {
        id: requestId,
        url: data.modelUrl,
        sourceImageId: '', // We'll need to track this better
        timestamp: Date.now(),
        metadata: {
          generationTime: parseFloat(data.generationTime),
          prompt: customPrompt || prompt,
        }
      }

      addGeneratedModel(newModel)

      if (onModelGenerated) {
        onModelGenerated(data.modelUrl)
      }

      performanceLogger.end(`3d-generation-${requestId}`)

    } catch (error) {
      logger.error('3D model generation failed', error)
      setError(error instanceof Error ? error.message : '3D generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!modelUrl) return

    const link = document.createElement('a')
    link.href = modelUrl
    link.download = '3d-model.glb'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleReset = () => {
    setModelUrl('')
    setError('')
    setGenerationTime(null)
  }

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500/10">
                <Box className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">Generate 3D Model</h3>
                <p className="text-sm text-muted-foreground">
                  Convert your image to a 3D mesh
                </p>
              </div>
            </div>
            {generationTime && (
              <Badge variant="outline">
                Generated in {generationTime.toFixed(1)}s
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

          {/* Smart Background Removal Detection */}
          {backgroundRemovedImageUrl && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Box className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Background Removed Image Available
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    We detected a background-removed version of your image. Using it for 3D generation can improve results by removing background noise.
                  </p>
                  <div className="flex items-center gap-3">
                    <Button
                      variant={useBackgroundRemovedImage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseBackgroundRemovedImage(true)}
                      className="gap-2"
                    >
                      <Box className="w-4 h-4" />
                      Use Background Removed
                    </Button>
                    <Button
                      variant={!useBackgroundRemovedImage ? "default" : "outline"}
                      size="sm"
                      onClick={() => setUseBackgroundRemovedImage(false)}
                    >
                      Use Original
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input Image */}
          {imageUrl && (
            <div className="mb-6">
              <h4 className="font-medium mb-2">
                Source Image
                {backgroundRemovedImageUrl && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({useBackgroundRemovedImage ? 'Background Removed' : 'Original'})
                  </span>
                )}
              </h4>
              <div className="relative w-48 h-48 rounded-lg overflow-hidden border mx-auto">
                <Image
                  src={useBackgroundRemovedImage && backgroundRemovedImageUrl ? backgroundRemovedImageUrl : imageUrl}
                  alt="Source image for 3D generation"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          )}

          {/* Quality Settings */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Quality Preset</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {qualityPresets.map((preset) => (
                  <Button
                    key={preset.value}
                    variant={qualityPreset === preset.value ? "default" : "outline"}
                    className="h-auto p-4 flex flex-col items-start"
                    onClick={() => setQualityPreset(preset.value)}
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-xs text-muted-foreground text-left">
                      {preset.description}
                    </span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <label className="text-sm font-medium mb-2 block">3D Model Description (Optional)</label>
              <textarea
                className="w-full p-3 border border-input rounded-lg bg-background resize-none"
                rows={2}
                placeholder="Describe how you want the 3D model to look..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
            </div>
          </div>

          {/* Generate Button */}
          {!modelUrl && (
            <Button
              onClick={handleGenerate3D}
              disabled={!imageUrl || isGenerating}
              className="w-full gap-2"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating 3D Model...
                </>
              ) : (
                <>
                  <Box className="w-4 h-4" />
                  Generate 3D Model
                </>
              )}
            </Button>
          )}

          {/* 3D Model Viewer */}
          {modelUrl && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Generated 3D Model</h4>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                  >
                    Generate New
                  </Button>
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Download GLB
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <ModelViewer 
                  src={modelUrl}
                  alt="Generated 3D model"
                  className="w-full"
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> Use mouse/touch to rotate, zoom, and pan the 3D model. 
                  The GLB file can be imported into Blender, Unity, or other 3D software.
                </p>
              </div>
            </div>
          )}

          {/* No Image State */}
          {!imageUrl && (
            <div className="text-center py-8 bg-muted/30 rounded-lg">
              <Box className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h4 className="font-medium text-muted-foreground mb-2">No Image Selected</h4>
              <p className="text-sm text-muted-foreground">
                Please select an image from your generated results to create a 3D model
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}