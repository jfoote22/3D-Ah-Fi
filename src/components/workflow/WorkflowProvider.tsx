'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflow-store'

interface WorkflowContextType {
  canProceedToStep: (step: WorkflowStep) => boolean
  getStepProgress: () => number
  getNextStep: () => WorkflowStep | null
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined)

export function useWorkflowContext() {
  const context = useContext(WorkflowContext)
  if (context === undefined) {
    throw new Error('useWorkflowContext must be used within a WorkflowProvider')
  }
  return context
}

interface WorkflowProviderProps {
  children: React.ReactNode
}

const stepOrder: WorkflowStep[] = ['prompt', 'generate', 'enhance', 'export']

export function WorkflowProvider({ children }: WorkflowProviderProps) {
  const { 
    currentStep, 
    completedSteps, 
    generatedImages, 
    setCurrentStep,
    completeStep 
  } = useWorkflowStore()

  // Auto-advance workflow logic
  useEffect(() => {
    if (currentStep === 'prompt' && generatedImages.length > 0) {
      completeStep('prompt')
      completeStep('generate')
      if (currentStep === 'prompt') {
        setCurrentStep('enhance')
      }
    }
  }, [generatedImages.length, currentStep, completeStep, setCurrentStep])

  const canProceedToStep = (step: WorkflowStep): boolean => {
    const stepIndex = stepOrder.indexOf(step)
    const currentIndex = stepOrder.indexOf(currentStep)
    
    // Can always go back to previous steps
    if (stepIndex <= currentIndex) return true
    
    // Can proceed if previous step is completed
    if (stepIndex === 0) return true
    const previousStep = stepOrder[stepIndex - 1]
    return completedSteps.has(previousStep)
  }

  const getStepProgress = (): number => {
    const currentIndex = stepOrder.indexOf(currentStep)
    const totalSteps = stepOrder.length
    return ((currentIndex + 1) / totalSteps) * 100
  }

  const getNextStep = (): WorkflowStep | null => {
    const currentIndex = stepOrder.indexOf(currentStep)
    if (currentIndex < stepOrder.length - 1) {
      return stepOrder[currentIndex + 1]
    }
    return null
  }

  const contextValue: WorkflowContextType = {
    canProceedToStep,
    getStepProgress,
    getNextStep,
  }

  return (
    <WorkflowContext.Provider value={contextValue}>
      {children}
    </WorkflowContext.Provider>
  )
}