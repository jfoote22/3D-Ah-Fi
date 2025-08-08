'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Image as ImageIcon, 
  MessageSquare, 
  Palette, 
  Sparkles, 
  RefreshCw, 
  Download, 
  X,
  ArrowRight,
  Settings,
  Wand2,
  History,
  Save
} from 'lucide-react'
import { useWorkflowStore } from '@/lib/stores/workflow-store'
import { WorkflowCard } from '../WorkflowCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { saveCreations, savePrompt } from '@/lib/firebase/firebaseUtils'
import { useRouter } from 'next/navigation'

type WorkflowMode = 'image-generation' | 'claude-prompt' | 'coloring-book'

interface ModernAIWorkflowStepProps {
  className?: string
}

const promptSuggestions = [
  "A majestic dragon soaring through clouds",
  "Cyberpunk city with neon lights at night", 
  "Serene mountain lake at sunset",
  "Futuristic robot in a garden",
  "Abstract geometric art in vibrant colors",
  "Vintage steam locomotive in motion"
]

export function ModernAIWorkflowStep({ className }: ModernAIWorkflowStepProps) {
  const { 
    prompt, 
    promptHistory, 
    setPrompt, 
    addToPromptHistory,
    setCurrentStep,
    completeStep,
    isGenerating,
    setGenerating,
    addGeneratedImage
  } = useWorkflowStore()
  const { user } = useAuth()
  const router = useRouter()
  const [savingImage, setSavingImage] = useState(false)
  const [imageSaved, setImageSaved] = useState(false)
  const [savingColoring, setSavingColoring] = useState(false)
  const [coloringSaved, setColoringSaved] = useState(false)
  
  // Mode state
  const [currentMode, setCurrentMode] = useState<WorkflowMode>('image-generation')
  const [localPrompt, setLocalPrompt] = useState(prompt)
  
  // Claude prompt enhancement state
  const [claudePrompt, setClaudePrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false)
  const [claudeError, setClaudeError] = useState('')
  
  // Coloring book state
  const [coloringBookThing, setColoringBookThing] = useState('')
  const [coloringBookAction, setColoringBookAction] = useState('')
  const [coloringBookStyle, setColoringBookStyle] = useState('')
  const [coloringBookResult, setColoringBookResult] = useState('')
  const [isGeneratingColoringBook, setIsGeneratingColoringBook] = useState(false)
  const [coloringBookError, setColoringBookError] = useState('')
  
  // Image generation state
  const [imageUrl, setImageUrl] = useState('')
  const [generationError, setGenerationError] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Handle prompt submission
  const handlePromptSubmit = () => {
    if (!localPrompt.trim()) return
    
    setPrompt(localPrompt.trim())
    addToPromptHistory(localPrompt.trim())
    
    if (currentMode === 'image-generation') {
      handleGenerateImage()
    }
  }

  // Generate image
  const handleGenerateImage = async () => {
    if (!localPrompt.trim() || isGenerating) return

    setGenerating(true)
    setGenerationError('')

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: localPrompt.trim(),
          aspect_ratio: aspectRatio
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const data = await response.json()
      console.log('Image generation response:', data)
      
      if (data.imageUrl) {
        console.log('Setting image URL:', data.imageUrl)
        setImageUrl(data.imageUrl)
        
        // Add to workflow store
        const newImage = {
          id: Date.now().toString(),
          url: data.imageUrl,
          prompt: localPrompt.trim(),
          timestamp: Date.now(),
          metadata: {
            model: data.model,
            generationTime: data.generationTime,
            aspectRatio: data.aspect_ratio,
          }
        }
        addGeneratedImage(newImage)
        
        completeStep('generate')
      } else {
        console.error('No image URL in response:', data)
        throw new Error('No image URL in response')
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  // Enhance prompt with Claude
  const handleEnhancePrompt = async () => {
    if (!claudePrompt.trim()) {
      setClaudeError('Please enter a prompt to enhance')
      return
    }

    setIsEnhancingPrompt(true)
    setClaudeError('')

    try {
      const response = await fetch('/api/anthropic/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: 'Enhance this prompt for image generation: "{{base_prompt}}". Make it more detailed, professional, and optimized for AI image generation. Include specific details about style, lighting, composition, and artistic elements.',
          variables: { base_prompt: claudePrompt.trim() }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to enhance prompt')
      }

      const data = await response.json()
      setEnhancedPrompt(data.generatedPrompt) // Changed from data.enhancedPrompt to data.generatedPrompt
      setLocalPrompt(data.generatedPrompt) // Update the main prompt
    } catch (error) {
      setClaudeError(error instanceof Error ? error.message : 'Enhancement failed')
    } finally {
      setIsEnhancingPrompt(false)
    }
  }

  // Generate coloring book
  const handleGenerateColoringBook = async () => {
    if (!coloringBookThing || !coloringBookAction) {
      setColoringBookError('Please enter both subject and action')
      return
    }

    setIsGeneratingColoringBook(true)
    setColoringBookError('')

    try {
      const response = await fetch('/api/anthropic/coloring-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thing: coloringBookThing,
          action: coloringBookAction,
          ...(coloringBookStyle && { style: coloringBookStyle })
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate coloring book')
      }

      const data = await response.json()
      console.log('Coloring book API response:', data)
      
      if (data.imageUrl) {
        console.log('Setting coloring book result URL:', data.imageUrl)
        setColoringBookResult(data.imageUrl)
      } else {
        console.error('No image URL in response:', data)
        setColoringBookError('No image URL received from API')
      }
    } catch (error) {
      setColoringBookError(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setIsGeneratingColoringBook(false)
    }
  }

  // Download functions
  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Save creation function
  const saveCreation = (type: 'image' | '3d-model' | 'coloring-book' | 'background-removed', url: string, prompt: string, additionalData?: any) => {
    try {
      const creation = {
        id: Date.now().toString(),
        [type === '3d-model' ? 'modelUrl' : 'imageUrl']: url,
        prompt,
        type,
        createdAt: new Date().toISOString(),
        userId: 'user', // This would come from auth context
        ...additionalData
      }

      const savedCreations = JSON.parse(localStorage.getItem('savedCreations') || '[]')
      savedCreations.unshift(creation)
      localStorage.setItem('savedCreations', JSON.stringify(savedCreations))
    } catch (error) {
      console.error('Failed to save creation:', error)
    }
  }

  // Handle suggestion clicks
  const handleSuggestionClick = (suggestion: string) => {
    setLocalPrompt(suggestion)
    setClaudePrompt(suggestion)
  }

  const handleHistoryClick = (historyPrompt: string) => {
    setLocalPrompt(historyPrompt)
    setClaudePrompt(historyPrompt)
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Mode Selection */}
      <WorkflowCard
        title="Choose Your Creative Mode"
        description="Select how you want to create your content"
        icon={Sparkles}
      >
        <Tabs value={currentMode} onValueChange={(value) => setCurrentMode(value as WorkflowMode)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="image-generation" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Generate Image
            </TabsTrigger>
            <TabsTrigger value="claude-prompt" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Enhance Prompt
            </TabsTrigger>
            <TabsTrigger value="coloring-book" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Coloring Book
            </TabsTrigger>
          </TabsList>

          {/* Image Generation Mode */}
          <TabsContent value="image-generation" className="space-y-4 mt-4">
            <div className="space-y-4">
              <Textarea
                placeholder="Describe your image in detail... (e.g., A majestic dragon flying over a medieval castle at sunset)"
                value={localPrompt}
                onChange={(e) => setLocalPrompt(e.target.value)}
                className="min-h-[120px] resize-none"
              />
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {localPrompt.length}/500 characters
                </span>
                <Button 
                  onClick={handleGenerateImage}
                  disabled={!localPrompt.trim() || isGenerating}
                  className="gap-2"
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

              {generationError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{generationError}</p>
                </div>
              )}

              {imageUrl && (
                <div className="space-y-4">
                  <div className="relative group overflow-hidden rounded-lg shadow-lg border border-border">
                    <Image
                      src={imageUrl}
                      alt="Generated image"
                      width={800}
                      height={600}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                  
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      onClick={() => downloadImage(imageUrl, `generated-image-${Date.now()}.png`)}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                    {user && (
                      <Button
                        onClick={async () => {
                          try {
                            setSavingImage(true)
                            await saveCreations(user.uid, [{ type: 'image', prompt: localPrompt, imageUrl, metadata: {} }])
                            setImageSaved(true)
                            setTimeout(() => setImageSaved(false), 2000)
                          } finally {
                            setSavingImage(false)
                          }
                        }}
                        variant="outline"
                        className="gap-2"
                      >
                        {imageSaved ? 'Saved' : savingImage ? 'Saving...' : (<><Save className="w-4 h-4" /> Save to Library</>)}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Claude Prompt Enhancement Mode */}
          <TabsContent value="claude-prompt" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Prompt</label>
                <Textarea
                  placeholder="Enter your basic prompt here..."
                  value={claudePrompt}
                  onChange={(e) => setClaudePrompt(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>
              
              <Button 
                onClick={handleEnhancePrompt}
                disabled={!claudePrompt.trim() || isEnhancingPrompt}
                className="gap-2"
              >
                {isEnhancingPrompt ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Enhance with Claude
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!claudePrompt.trim()) return
                  if (!user) { router.push('/login'); return }
                  await savePrompt(user.uid, claudePrompt)
                }}
              >
                <Save className="w-4 h-4" />
                Save Prompt
              </Button>

              {claudeError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{claudeError}</p>
                </div>
              )}

              {enhancedPrompt && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Enhanced Prompt</label>
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <p className="text-sm">{enhancedPrompt}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setLocalPrompt(enhancedPrompt)
                        setCurrentMode('image-generation')
                      }}
                      className="gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      Use for Image Generation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEnhancedPrompt('')}
                    >
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Coloring Book Mode */}
          <TabsContent value="coloring-book" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g., cat, dragon, castle"
                    value={coloringBookThing}
                    onChange={(e) => setColoringBookThing(e.target.value)}
                    className="w-full p-3 border border-input rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Action</label>
                  <input
                    type="text"
                    placeholder="e.g., playing, flying, sleeping"
                    value={coloringBookAction}
                    onChange={(e) => setColoringBookAction(e.target.value)}
                    className="w-full p-3 border border-input rounded-lg bg-background"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Style (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., cartoon, realistic, fantasy"
                  value={coloringBookStyle}
                  onChange={(e) => setColoringBookStyle(e.target.value)}
                  className="w-full p-3 border border-input rounded-lg bg-background"
                />
              </div>
              
              <Button 
                onClick={handleGenerateColoringBook}
                disabled={!coloringBookThing || !coloringBookAction || isGeneratingColoringBook}
                className="gap-2"
              >
                {isGeneratingColoringBook ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Palette className="w-4 h-4" />
                    Create Coloring Book
                  </>
                )}
              </Button>

              {coloringBookError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{coloringBookError}</p>
                </div>
              )}

              {coloringBookResult && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Coloring Book Page</label>
                    <div className="relative group overflow-hidden rounded-lg shadow-lg border border-slate-700">
                      <Image
                        src={coloringBookResult}
                        alt="Generated coloring book"
                        width={400}
                        height={400}
                        className="w-full h-auto object-contain bg-white"
                        onError={(e) => {
                          console.error('Image failed to load:', coloringBookResult)
                          setColoringBookError('Failed to load generated image')
                        }}
                        onLoad={() => {
                          console.log('Image loaded successfully:', coloringBookResult)
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => downloadImage(coloringBookResult, `coloring-book-${Date.now()}.png`)}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </Button>
                    {user && (
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            setSavingColoring(true)
                            await saveCreations(user.uid, [{ type: 'coloring-book', prompt: `${coloringBookThing} ${coloringBookAction}${coloringBookStyle ? ' ' + coloringBookStyle : ''}`, imageUrl: coloringBookResult, metadata: {} }])
                            setColoringSaved(true)
                            setTimeout(() => setColoringSaved(false), 2000)
                          } finally {
                            setSavingColoring(false)
                          }
                        }}
                      >
                        {coloringSaved ? 'Saved' : savingColoring ? 'Saving...' : (<><Save className="w-4 h-4" /> Save to Library</>)}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setColoringBookResult('')}
                    >
                      <X className="w-4 h-4" />
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </WorkflowCard>

      {/* Prompt Suggestions */}
      <WorkflowCard
        title="Prompt Suggestions"
        description="Get inspired with these creative ideas"
        icon={Sparkles}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {promptSuggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              onClick={() => handleSuggestionClick(suggestion)}
              className="justify-start h-auto p-3 text-left"
            >
              <span className="truncate">{suggestion}</span>
            </Button>
          ))}
        </div>
      </WorkflowCard>

      {/* Prompt History */}
      {promptHistory.length > 0 && (
        <WorkflowCard
          title="Recent Prompts"
          description="Reuse your previous prompts"
          icon={History}
          resultCount={promptHistory.length}
        >
          <div className="space-y-2">
            {promptHistory.slice(0, 5).map((historyPrompt, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors cursor-pointer"
                onClick={() => handleHistoryClick(historyPrompt)}
              >
                <span className="flex-1 truncate text-sm">{historyPrompt}</span>
                <Badge variant="secondary" className="ml-2 text-xs">
                  Use
                </Badge>
              </div>
            ))}
          </div>
        </WorkflowCard>
      )}
    </div>
  )
} 