import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'

export type WorkflowStep = 'prompt' | 'generate' | 'enhance' | 'export'

export interface GeneratedImage {
  id: string
  url: string
  prompt: string
  timestamp: number
  backgroundRemovedUrl?: string // Add background removed image URL
  metadata?: {
    model?: string
    generationTime?: number
    seed?: number | null
    aspectRatio?: string
  }
}

export interface Model3D {
  id: string
  url: string
  sourceImageId: string
  timestamp: number
  metadata?: {
    generationTime?: number
    prompt?: string
  }
}

export interface WorkflowState {
  // Current workflow step
  currentStep: WorkflowStep
  completedSteps: Set<WorkflowStep>
  
  // Prompt state
  prompt: string
  promptHistory: string[]
  
  // Image generation state
  isGenerating: boolean
  generatedImages: GeneratedImage[]
  selectedImageId: string | null
  
  // Enhancement state
  isEnhancing: boolean
  enhancementType: 'background-removal' | 'image-to-image' | '3d-model' | null
  
  // 3D model state
  is3DGenerating: boolean
  generatedModels: Model3D[]
  
  // UI state
  sidebarCollapsed: boolean
  showOnboarding: boolean
  
  // Actions
  setCurrentStep: (step: WorkflowStep) => void
  completeStep: (step: WorkflowStep) => void
  setPrompt: (prompt: string) => void
  addToPromptHistory: (prompt: string) => void
  setGenerating: (isGenerating: boolean) => void
  addGeneratedImage: (image: GeneratedImage) => void
  updateImageBackgroundRemoved: (imageId: string, backgroundRemovedUrl: string) => void
  setSelectedImage: (imageId: string | null) => void
  setEnhancing: (isEnhancing: boolean) => void
  setEnhancementType: (type: WorkflowState['enhancementType']) => void
  set3DGenerating: (isGenerating: boolean) => void
  addGeneratedModel: (model: Model3D) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setShowOnboarding: (show: boolean) => void
  resetWorkflow: () => void
}

const initialState = {
  currentStep: 'prompt' as WorkflowStep,
  completedSteps: new Set<WorkflowStep>(),
  prompt: '',
  promptHistory: [],
  isGenerating: false,
  generatedImages: [],
  selectedImageId: null,
  isEnhancing: false,
  enhancementType: null,
  is3DGenerating: false,
  generatedModels: [],
  sidebarCollapsed: false,
  showOnboarding: true,
}

export const useWorkflowStore = create<WorkflowState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,
      
      setCurrentStep: (step) => {
        set({ currentStep: step })
      },
      
      completeStep: (step) => {
        const completedSteps = new Set(get().completedSteps)
        completedSteps.add(step)
        set({ completedSteps })
      },
      
      setPrompt: (prompt) => {
        set({ prompt })
      },
      
      addToPromptHistory: (prompt) => {
        const history = get().promptHistory
        if (!history.includes(prompt)) {
          set({ 
            promptHistory: [prompt, ...history].slice(0, 10) // Keep last 10
          })
        }
      },
      
      setGenerating: (isGenerating) => {
        set({ isGenerating })
      },
      
      addGeneratedImage: (image) => {
        const images = get().generatedImages
        set({ 
          generatedImages: [image, ...images],
          selectedImageId: image.id
        })
      },
      
      updateImageBackgroundRemoved: (imageId, backgroundRemovedUrl) => {
        const images = get().generatedImages
        const updatedImages = images.map(img => 
          img.id === imageId 
            ? { ...img, backgroundRemovedUrl }
            : img
        )
        set({ generatedImages: updatedImages })
      },
      
      setSelectedImage: (imageId) => {
        set({ selectedImageId: imageId })
      },
      
      setEnhancing: (isEnhancing) => {
        set({ isEnhancing })
      },
      
      setEnhancementType: (enhancementType) => {
        set({ enhancementType })
      },
      
      set3DGenerating: (is3DGenerating) => {
        set({ is3DGenerating })
      },
      
      addGeneratedModel: (model) => {
        const models = get().generatedModels
        set({ 
          generatedModels: [model, ...models]
        })
      },
      
      setSidebarCollapsed: (sidebarCollapsed) => {
        set({ sidebarCollapsed })
      },
      
      setShowOnboarding: (showOnboarding) => {
        set({ showOnboarding })
      },
      
      resetWorkflow: () => {
        set({
          ...initialState,
          promptHistory: get().promptHistory, // Keep prompt history
          sidebarCollapsed: get().sidebarCollapsed, // Keep UI preferences
          showOnboarding: false, // Don't show onboarding again
        })
      },
    })),
    {
      name: 'workflow-store',
    }
  )
)

// Selectors for better performance
export const useCurrentStep = () => useWorkflowStore((state) => state.currentStep)
export const useGeneratedImages = () => useWorkflowStore((state) => state.generatedImages)
export const useSelectedImage = () => useWorkflowStore((state) => {
  const { generatedImages, selectedImageId } = state
  return generatedImages.find(img => img.id === selectedImageId) || null
})
export const useIsAnyLoading = () => useWorkflowStore((state) => 
  state.isGenerating || state.isEnhancing || state.is3DGenerating
)