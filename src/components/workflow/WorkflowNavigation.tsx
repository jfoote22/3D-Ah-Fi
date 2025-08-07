'use client'

import React from 'react'
import { Check, Wand2, Image, Sparkles, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflow-store'
import { useWorkflowContext } from './WorkflowProvider'
import { Progress } from '@/components/ui/progress'

const stepConfig = {
  prompt: {
    label: 'Create Prompt',
    description: 'Describe what you want to create',
    icon: Wand2,
  },
  generate: {
    label: 'Generate Image',
    description: 'AI creates your image',
    icon: Image,
  },
  enhance: {
    label: 'Enhance & Edit',
    description: 'Improve and modify your creation',
    icon: Sparkles,
  },
  export: {
    label: 'Save & Export',
    description: 'Download and share your work',
    icon: Download,
  },
}

interface WorkflowNavigationProps {
  className?: string
}

export function WorkflowNavigation({ className }: WorkflowNavigationProps) {
  const { currentStep, completedSteps, setCurrentStep } = useWorkflowStore()
  const { canProceedToStep, getStepProgress } = useWorkflowContext()

  const steps: WorkflowStep[] = ['prompt', 'generate', 'enhance', 'export']

  return (
    <div className={cn('w-full max-w-4xl mx-auto', className)}>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Progress</span>
          <span className="text-sm text-muted-foreground">
            {Math.round(getStepProgress())}% Complete
          </span>
        </div>
        <Progress value={getStepProgress()} className="h-2" />
      </div>

      {/* Step Navigation */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const config = stepConfig[step]
            const Icon = config.icon
            const isActive = currentStep === step
            const isCompleted = completedSteps.has(step)
            const canProceed = canProceedToStep(step)
            const isClickable = canProceed || isCompleted

            return (
              <div
                key={step}
                className="flex flex-col items-center relative z-10"
              >
                {/* Step Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-full top-6 w-full h-0.5 -translate-y-1/2',
                      'transition-colors duration-300',
                      isCompleted
                        ? 'bg-primary'
                        : 'bg-muted'
                    )}
                    style={{
                      width: 'calc(100vw / 4 - 4rem)', // Adjust based on step count
                      transform: 'translateX(2rem) translateY(-50%)'
                    }}
                  />
                )}

                {/* Step Circle */}
                <button
                  onClick={() => isClickable && setCurrentStep(step)}
                  disabled={!isClickable}
                  className={cn(
                    'flex items-center justify-center w-12 h-12 rounded-full',
                    'transition-all duration-300 relative',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    isActive && 'scale-110 shadow-lg',
                    isCompleted && 'bg-primary text-primary-foreground',
                    !isCompleted && isActive && 'bg-primary/20 text-primary border-2 border-primary',
                    !isCompleted && !isActive && canProceed && 'bg-muted text-muted-foreground hover:bg-muted/80',
                    !canProceed && 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className={cn('w-5 h-5', isActive && 'animate-pulse')} />
                  )}
                  
                  {/* Active Step Glow */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-glow" />
                  )}
                </button>

                {/* Step Label */}
                <div className="mt-3 text-center max-w-24">
                  <div
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isActive ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {config.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-tight">
                    {config.description}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Current Step Indicator */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium">
            {stepConfig[currentStep].label}
          </span>
        </div>
      </div>
    </div>
  )
}