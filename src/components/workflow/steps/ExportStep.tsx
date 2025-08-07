'use client'

import React from 'react'
import { Download, Share2, Save, RefreshCw, CheckCircle } from 'lucide-react'
import { useWorkflowStore, useSelectedImage } from '@/lib/stores/workflow-store'
import { WorkflowCard } from '../WorkflowCard'
import { SaveToLibraryTool } from '@/components/tools/SaveToLibraryTool'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

export function ExportStep() {
  const { 
    resetWorkflow,
    generatedImages,
    generatedModels 
  } = useWorkflowStore()
  
  const selectedImage = useSelectedImage()

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleStartNew = () => {
    resetWorkflow()
  }

  return (
    <div className="space-y-6">
      <WorkflowCard
        title="Export & Save"
        description="Your creations are ready to download and save"
        icon={CheckCircle}
        status="success"
        actions={
          <Button onClick={handleStartNew} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Start New Project
          </Button>
        }
      >
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Creative Journey Complete!</h3>
          <p className="text-muted-foreground">
            Download your creations or save them to your library
          </p>
        </div>
      </WorkflowCard>

      {/* Save to Library */}
      <SaveToLibraryTool />

      {/* Generated Images */}
      {generatedImages.length > 0 && (
        <WorkflowCard
          title="Generated Images"
          description="Download your created images"
          icon={Save}
          resultCount={generatedImages.length}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {generatedImages.map((image, index) => (
              <Card key={image.id}>
                <CardContent className="p-4">
                  <div className="relative aspect-square rounded-lg overflow-hidden mb-3">
                    <Image
                      src={image.url}
                      alt={image.prompt}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm truncate">{image.prompt}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">
                        {image.metadata?.aspectRatio || '1:1'}
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => handleDownload(
                          image.url, 
                          `3d-ah-fi-image-${index + 1}.png`
                        )}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </WorkflowCard>
      )}

      {/* Generated 3D Models */}
      {generatedModels.length > 0 && (
        <WorkflowCard
          title="Generated 3D Models"
          description="Download your 3D models"
          icon={Save}
          resultCount={generatedModels.length}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {generatedModels.map((model, index) => (
              <Card key={model.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">3D Model {index + 1}</h4>
                        <p className="text-sm text-muted-foreground">
                          Generated from image
                        </p>
                      </div>
                      <Badge variant="outline">GLB</Badge>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => handleDownload(
                        model.url, 
                        `3d-ah-fi-model-${index + 1}.glb`
                      )}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download 3D Model
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </WorkflowCard>
      )}

      {/* Share Options */}
      <WorkflowCard
        title="Share Your Creations"
        description="Show off your AI-generated content"
        icon={Share2}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" className="h-12">
            <Share2 className="w-4 h-4 mr-2" />
            Twitter
          </Button>
          <Button variant="outline" className="h-12">
            <Share2 className="w-4 h-4 mr-2" />
            Instagram
          </Button>
          <Button variant="outline" className="h-12">
            <Share2 className="w-4 h-4 mr-2" />
            Discord
          </Button>
          <Button variant="outline" className="h-12">
            <Share2 className="w-4 h-4 mr-2" />
            Copy Link
          </Button>
        </div>
      </WorkflowCard>
    </div>
  )
}