'use client'

import React from 'react'
import { Image as ImageIcon, ArrowRight, Wand2 } from 'lucide-react'
import { useWorkflowStore, useGeneratedImages } from '@/lib/stores/workflow-store'
import { WorkflowCard } from '../WorkflowCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ImageGenerationTool } from '@/components/tools/ImageGenerationTool'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function GenerateStep() {
  const { 
    prompt,
    selectedImageId,
    setSelectedImage,
    setCurrentStep,
    completeStep
  } = useWorkflowStore()
  
  const generatedImages = useGeneratedImages()

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