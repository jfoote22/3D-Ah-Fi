'use client'

import React, { useState } from 'react'
import { Image as ImageIcon, ArrowRight, Wand2, Save, Check } from 'lucide-react'
import { useWorkflowStore, useGeneratedImages } from '@/lib/stores/workflow-store'
import { WorkflowCard } from '../WorkflowCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ImageGenerationTool } from '@/components/tools/ImageGenerationTool'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { saveCreations } from '@/lib/firebase/firebaseUtils'

export function GenerateStep() {
  const { 
    prompt,
    selectedImageId,
    setSelectedImage,
    setCurrentStep,
    completeStep
  } = useWorkflowStore()
  
  const generatedImages = useGeneratedImages()
  const { user } = useAuth()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({})

  const handleImageGenerated = () => {
    completeStep('generate')
  }

  const handleImageSelect = (imageId: string) => {
    setSelectedImage(imageId)
  }

  const handleProceedToEnhance = () => {
    if (generatedImages.length > 0) {
      completeStep('generate')
      setCurrentStep('enhance')
    }
  }

  const saveSingleImage = async (imageId: string) => {
    const image = generatedImages.find(i => i.id === imageId)
    if (!image || !user || savedMap[imageId]) return
    try {
      setSavingId(imageId)
      await saveCreations(user.uid, [{
        type: 'image',
        prompt: image.prompt,
        imageUrl: image.url,
        aspectRatio: image.metadata?.aspectRatio,
        model: image.metadata?.model,
        metadata: image.metadata,
      }])
      setSavedMap(prev => ({ ...prev, [imageId]: true }))
    } finally {
      setSavingId(null)
    }
  }

  const selectedImage = generatedImages.find(img => img.id === selectedImageId)

  if (!prompt.trim()) {
    return (
      <WorkflowCard
        title="No Prompt Available"
        description="Please go back and create a prompt first"
        icon={Wand2}
      >
        <Button 
          variant="outline" 
          onClick={() => setCurrentStep('prompt')}
        >
          Back to Create Prompt
        </Button>
      </WorkflowCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Image Generation Tool */}
      <ImageGenerationTool onImageGenerated={handleImageGenerated} />

      {/* Generated Images Grid */}
      {generatedImages.length > 0 && (
        <WorkflowCard
          title="Generated Images"
          description="Select an image to enhance or proceed with"
          icon={ImageIcon}
          resultCount={generatedImages.length}
          actions={
            generatedImages.length > 0 && (
              <Button onClick={() => setCurrentStep('enhance')} className="gap-2">
                Continue to Enhancement
                <ArrowRight className="w-4 h-4" />
              </Button>
            )
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedImages.map((image) => (
              <Card 
                key={image.id}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-lg",
                  selectedImageId === image.id && "ring-2 ring-primary"
                )}
                onClick={() => handleImageSelect(image.id)}
              >
                <CardContent className="p-2">
                  <div className="relative aspect-square rounded-lg overflow-hidden">
                    <Image
                      src={image.url}
                      alt={image.prompt}
                      fill
                      className="object-cover"
                    />
                    {selectedImageId === image.id && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Badge className="bg-primary text-primary-foreground">
                          Selected
                        </Badge>
                      </div>
                    )}
                    {user && (
                      <div className="absolute bottom-2 right-2">
                        <Button
                          size="sm"
                          variant={savedMap[image.id] ? 'secondary' : 'secondary'}
                          onClick={(e) => { e.stopPropagation(); saveSingleImage(image.id) }}
                          className="gap-1"
                          disabled={!!savedMap[image.id] || savingId === image.id}
                        >
                          {savedMap[image.id] ? (
                            <><Check className="w-3 h-3" /> Saved</>
                          ) : savingId === image.id ? (
                            <>Saving...</>
                          ) : (
                            <><Save className="w-3 h-3" /> Save</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {image.prompt}
                    </p>
                    {image.metadata?.generationTime && (
                      <p className="text-xs text-muted-foreground">
                        {image.metadata.generationTime}s
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </WorkflowCard>
      )}
    </div>
  )
}