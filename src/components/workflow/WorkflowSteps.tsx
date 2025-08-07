'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkflowStore } from '@/lib/stores/workflow-store'
import { WorkflowCard } from './WorkflowCard'

// Import step components (we'll create these)
import { PromptStep } from './steps/PromptStep'
import { GenerateStep } from './steps/GenerateStep'
import { EnhanceStep } from './steps/EnhanceStep'
import { ExportStep } from './steps/ExportStep'
import { ModernAIWorkflowStep } from './steps/ModernAIWorkflowStep'

interface WorkflowStepsProps {
  className?: string
}

export function WorkflowSteps({ className }: WorkflowStepsProps) {
  const currentStep = useWorkflowStore(state => state.currentStep)

  const renderStep = () => {
    switch (currentStep) {
      case 'prompt':
        return <ModernAIWorkflowStep />
      case 'generate':
        return <GenerateStep />
      case 'enhance':
        return <EnhanceStep />
      case 'export':
        return <ExportStep />
      default:
        return <ModernAIWorkflowStep />
    }
  }

  return (
    <div className={className}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="w-full"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}