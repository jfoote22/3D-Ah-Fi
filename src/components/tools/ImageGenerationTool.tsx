'use client'

import React, { useState } from 'react'
import { Image as ImageIcon, Settings, Wand2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useWorkflowStore } from '@/lib/stores/workflow-store'
import { generateId } from '@/lib/utils'
import { logger, performanceLogger } from '@/lib/utils/logger'

interface ImageGenerationResponse {
  imageUrl: string
  model?: string
  modelId?: string
  aspect_ratio?: string
  generationTime?: number
  prompt?: string
  seed?: number | null
  negativePrompt?: string | null
  personGeneration?: string
}

interface ImageGenerationToolProps {
  onImageGenerated?: (imageData: ImageGenerationResponse) => void
  className?: string
}

const aspectRatios = [
  { value: '1:1', label: 'Square', dimensions: '1024×1024' },
  { value: '4:3', label: 'Landscape', dimensions: '1152×896' },
  { value: '3:4', label: 'Portrait', dimensions: '896×1152' },
  { value: '16:9', label: 'Wide', dimensions: '1344×768' },
  { value: '9:16', label: 'Tall', dimensions: '768×1344' },
]

const qualityPresets = [
  { value: 'standard', label: 'Standard', description: 'Balanced quality and speed' },
  { value: 'high', label: 'High Quality', description: 'Better detail, slower generation' },
  { value: 'fast', label: 'Fast', description: 'Quick generation, good quality' },
]

export function ImageGenerationTool({ onImageGenerated, className }: ImageGenerationToolProps) {
  const { prompt, isGenerating, setGenerating, addGeneratedImage } = useWorkflowStore()
  
  // Local state for generation settings
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [numberOfImages, setNumberOfImages] = useState(1)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [personGeneration, setPersonGeneration] = useState('allow_adult')
  const [useRandomSeed, setUseRandomSeed] = useState(true)
  const [seed, setSeed] = useState<number | null>(null)
  const [qualityPreset, setQualityPreset] = useState('standard')
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Generation state
  const [error, setError] = useState('')
  const [generationProgress, setGenerationProgress] = useState(0)

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return

    const requestId = generateId()
    performanceLogger.start(`image-generation-${requestId}`)
    setGenerating(true)
    setError('')
    setGenerationProgress(0)

    try {
      logger.info('Starting image generation', { prompt: prompt.substring(0, 50) + '...' })

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      const requestBody = {
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        numberOfImages,
        negativePrompt: negativePrompt.trim() || undefined,
        personGeneration,
        seed: useRandomSeed ? undefined : seed,
      }

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      clearInterval(progressInterval)
      setGenerationProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const data: ImageGenerationResponse = await response.json()
      
      logger.info('Image generation successful', { 
        generationTime: data.generationTime,
        model: data.model 
      })

      // Add to workflow store
      const newImage = {
        id: requestId,
        url: data.imageUrl,
        prompt: prompt,
        timestamp: Date.now(),
        metadata: {
          model: data.model,
          generationTime: data.generationTime,
          aspectRatio: data.aspect_ratio,
          seed: data.seed,
        }
      }

      addGeneratedImage(newImage)
      
      // Call callback if provided
      if (onImageGenerated) {
        onImageGenerated(data)
      }

      performanceLogger.end(`image-generation-${requestId}`)

    } catch (error) {
      logger.error('Image generation failed', error)
      setError(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setGenerating(false)
      setGenerationProgress(0)
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Quick Generate */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Generate Image</h3>
                <p className="text-sm text-muted-foreground">
                  Create AI images from your prompt
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="w-4 h-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Settings
            </Button>
          </div>

          <div className="space-y-4">
            {/* Progress bar during generation */}
            {isGenerating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Generating image...</span>
                  <span>{generationProgress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${generationProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">Generation failed:</p>
                <p className="text-sm text-destructive/80">{error}</p>
              </div>
            )}

            {/* Quick settings */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Size:</span>
                {aspectRatios.slice(0, 3).map((ratio) => (
                  <Button
                    key={ratio.value}
                    variant={aspectRatio === ratio.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAspectRatio(ratio.value)}
                  >
                    {ratio.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full gap-2"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Image
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      {showAdvanced && (
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Aspect Ratio</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {aspectRatios.map((ratio) => (
                      <Button
                        key={ratio.value}
                        variant={aspectRatio === ratio.value ? "default" : "outline"}
                        className="h-auto p-3 flex flex-col items-center"
                        onClick={() => setAspectRatio(ratio.value)}
                      >
                        <span className="font-medium">{ratio.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {ratio.dimensions}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Quality</label>
                  <div className="space-y-2">
                    {qualityPresets.map((preset) => (
                      <Button
                        key={preset.value}
                        variant={qualityPreset === preset.value ? "default" : "outline"}
                        className="w-full justify-start h-auto p-4"
                        onClick={() => setQualityPreset(preset.value)}
                      >
                        <div className="text-left">
                          <div className="font-medium">{preset.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {preset.description}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="style" className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Negative Prompt
                  </label>
                  <textarea
                    className="w-full p-3 border border-input rounded-lg bg-background resize-none"
                    rows={3}
                    placeholder="What to avoid in the image (e.g., blurry, low quality, text)"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Describe what you don&apos;t want in the generated image
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Person Generation
                  </label>
                  <select
                    className="w-full p-3 border border-input rounded-lg bg-background"
                    value={personGeneration}
                    onChange={(e) => setPersonGeneration(e.target.value)}
                  >
                    <option value="allow_adult">Allow adults</option>
                    <option value="allow_all">Allow all ages</option>
                    <option value="no_people">No people</option>
                  </select>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Random Seed</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUseRandomSeed(!useRandomSeed)}
                    >
                      {useRandomSeed ? 'Random' : 'Fixed'}
                    </Button>
                  </div>
                  {!useRandomSeed && (
                    <input
                      type="number"
                      className="w-full p-3 border border-input rounded-lg bg-background"
                      placeholder="Enter seed number"
                      value={seed || ''}
                      onChange={(e) => setSeed(Number(e.target.value) || null)}
                    />
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Number of Images
                  </label>
                  <select
                    className="w-full p-3 border border-input rounded-lg bg-background"
                    value={numberOfImages}
                    onChange={(e) => setNumberOfImages(Number(e.target.value))}
                  >
                    <option value={1}>1 image</option>
                    <option value={2}>2 images</option>
                    <option value={4}>4 images</option>
                  </select>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}