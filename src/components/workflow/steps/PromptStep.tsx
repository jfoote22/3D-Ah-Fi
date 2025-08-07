'use client'

import React, { useState } from 'react'
import { Wand2, Sparkles, History, ArrowRight } from 'lucide-react'
import { useWorkflowStore } from '@/lib/stores/workflow-store'
import { WorkflowCard } from '../WorkflowCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const promptSuggestions = [
  "A majestic dragon soaring through clouds",
  "Cyberpunk city with neon lights at night", 
  "Serene mountain lake at sunset",
  "Futuristic robot in a garden",
  "Abstract geometric art in vibrant colors",
  "Vintage steam locomotive in motion"
]

export function PromptStep() {
  const { 
    prompt, 
    promptHistory, 
    setPrompt, 
    addToPromptHistory,
    setCurrentStep,
    completeStep
  } = useWorkflowStore()
  
  const [localPrompt, setLocalPrompt] = useState(prompt)

  const handlePromptSubmit = () => {
    if (!localPrompt.trim()) return
    
    setPrompt(localPrompt.trim())
    addToPromptHistory(localPrompt.trim())
    completeStep('prompt')
    setCurrentStep('generate')
  }

  const handleSuggestionClick = (suggestion: string) => {
    setLocalPrompt(suggestion)
  }

  const handleHistoryClick = (historyPrompt: string) => {
    setLocalPrompt(historyPrompt)
  }

  return (
    <div className="space-y-6">
      <WorkflowCard
        title="Create Your Prompt"
        description="Describe what you want to create in detail"
        icon={Wand2}
        status={localPrompt.trim() ? 'success' : 'idle'}
      >
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
              onClick={handlePromptSubmit}
              disabled={!localPrompt.trim()}
              className="gap-2"
            >
              Generate Image
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
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