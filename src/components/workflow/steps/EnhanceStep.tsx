'use client'

import React, { useState } from 'react'
import { Sparkles, Scissors, Box, Wand2, ArrowRight } from 'lucide-react'
import { useWorkflowStore, useSelectedImage } from '@/lib/stores/workflow-store'
import { WorkflowCard } from '../WorkflowCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BackgroundRemovalTool } from '@/components/tools/BackgroundRemovalTool'
import { ThreeDModelTool } from '@/components/tools/ThreeDModelTool'
import Image from 'next/image'

const enhancementOptions = [
  {
    id: 'background-removal',
    title: 'Remove Background',
    description: 'Create transparent background',
    icon: Scissors,
  },
  {
    id: '3d-model',
    title: 'Generate 3D Model',
    description: 'Convert to 3D mesh',
    icon: Box,
  },
  {
    id: 'image-to-image',
    title: 'Style Transfer',
    description: 'Apply new styles',
    icon: Wand2,
  },
]

export function EnhanceStep() {
  const { 
    enhancementType,
    isEnhancing,
    setEnhancementType,
    setCurrentStep,
    completeStep
  } = useWorkflowStore()
  
  const selectedImage = useSelectedImage()
  const [activeTab, setActiveTab] = useState('background-removal')

  const handleEnhancementSelect = (type: string) => {
    setEnhancementType(type as any)
    setActiveTab(type)
  }

  const handleProceedToExport = () => {
    completeStep('enhance')
    setCurrentStep('export')
  }

  const handleEnhancementComplete = () => {
    completeStep('enhance')
  }

  if (!selectedImage) {
    return (
      <WorkflowCard
        title="No Image Selected"
        description="Please go back and select an image to enhance"
        icon={Sparkles}
      >
        <Button 
          variant="outline" 
          onClick={() => setCurrentStep('generate')}
        >
          Back to Generate
        </Button>
      </WorkflowCard>
    )
  }

  return (
    <div className="space-y-6">
      {/* Selected Image Preview */}
      <WorkflowCard
        title="Selected Image"
        description="Ready for enhancement"
        icon={Sparkles}
        actions={
          <Button onClick={handleProceedToExport} className="gap-2">
            Skip to Export
            <ArrowRight className="w-4 h-4" />
          </Button>
        }
      >
        <Card>
          <CardContent className="p-4">
            <div className="relative w-64 h-64 mx-auto rounded-lg overflow-hidden">
              <Image
                src={selectedImage.url}
                alt={selectedImage.prompt}
                fill
                className="object-cover"
              />
            </div>
            <p className="text-sm text-center text-muted-foreground mt-3">
              {selectedImage.prompt}
            </p>
          </CardContent>
        </Card>
      </WorkflowCard>

      {/* Enhancement Tools */}
      <WorkflowCard
        title="Enhancement Tools"
        description="Transform and improve your image"
        icon={Sparkles}
        actions={
          <Button onClick={handleProceedToExport} className="gap-2">
            Continue to Export
            <ArrowRight className="w-4 h-4" />
          </Button>
        }
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="background-removal" className="flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Remove BG
            </TabsTrigger>
            <TabsTrigger value="3d-model" className="flex items-center gap-2">
              <Box className="w-4 h-4" />
              3D Model
            </TabsTrigger>
            <TabsTrigger value="image-to-image" className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" />
              Style Edit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="background-removal" className="mt-6">
            <BackgroundRemovalTool 
              imageUrl={selectedImage.url}
              imageId={selectedImage.id}
              onRemovalComplete={handleEnhancementComplete}
            />
          </TabsContent>

          <TabsContent value="3d-model" className="mt-6">
            <ThreeDModelTool 
              imageUrl={selectedImage.url}
              prompt={selectedImage.prompt}
              backgroundRemovedImageUrl={selectedImage.backgroundRemovedUrl}
              onModelGenerated={handleEnhancementComplete}
            />
          </TabsContent>

          <TabsContent value="image-to-image" className="mt-6">
            <div className="text-center py-8 bg-muted/30 rounded-lg">
              <Wand2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h4 className="font-medium text-muted-foreground mb-2">Coming Soon</h4>
              <p className="text-sm text-muted-foreground">
                Image-to-image style transfer will be available in the next update
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </WorkflowCard>
    </div>
  )
}