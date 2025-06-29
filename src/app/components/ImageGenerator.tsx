'use client';

import { useState } from 'react';
import Image from 'next/image';
import ModelViewer from './ModelViewer';
import { useAuth } from '@/lib/hooks/useAuth';
import { storage } from '@/lib/firebase/firebase';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Loader2, Box } from 'lucide-react';

// Define interfaces for the response types
interface ImageGenerationResponse {
  imageUrl: string;
  model?: string;
  modelId?: string;
  width?: number;
  height?: number;
  inferenceSteps?: number;
  guidanceScale?: number;
  generationTime?: number;
  prompt?: string;
  aspect_ratio?: string;
  numberOfImages?: number;
  seed?: number | null;
  negativePrompt?: string | null;
  personGeneration?: string;
  // Image-to-image specific fields
  strength?: number;
  guidance_scale?: number;
  num_inference_steps?: number;
  negative_prompt?: string;
}

interface ModelGenerationResponse {
  modelUrl: string;
  generationTime?: number;
  sourceImageUrl?: string;
  prompt?: string;
  error?: string;
}

interface SavedImage {
  id?: string;
  imageUrl: string;
  prompt: string;
  modelUrl?: string;
  createdAt: any;
  userId: string;
}

// Default model ID as fallback
const DEFAULT_MODEL_ID = "stability-ai/sdxl:c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316";

// Helper function to generate a clean filename
const generateFilename = (prompt: string, type: 'image' | 'coloring' | '3d') => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const cleanPrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').toLowerCase();
  const extension = type === '3d' ? 'glb' : 'png';
  return `${type}-${cleanPrompt}-${timestamp}.${extension}`;
};

// Helper function to download files via our API (handles CORS issues)
const downloadFile = async (url: string, filename: string) => {
  try {
    const downloadUrl = `/api/download-image?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download failed:', error);
    // Fallback to direct download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export default function ImageGenerator() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [detailedError, setDetailedError] = useState('');
  const [imageKey, setImageKey] = useState(0); // Used to force image refresh
  const [imageDetails, setImageDetails] = useState<ImageGenerationResponse | null>(null);

  // Advanced parameter states
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [negativePrompt, setNegativePrompt] = useState('');
  const [personGeneration, setPersonGeneration] = useState('allow_adult');
  const [useRandomSeed, setUseRandomSeed] = useState(true);
  const [seed, setSeed] = useState<number | null>(null);

  // Creative control states
  const [showStyleButtons, setShowStyleButtons] = useState(false);
  const [showPhotographyControls, setShowPhotographyControls] = useState(false);
  const [qualityLevel, setQualityLevel] = useState('standard');
  const [creativityLevel, setCreativityLevel] = useState('balanced');

  // For 3D model generation
  const [modelUrl, setModelUrl] = useState('');
  const [generating3D, setGenerating3D] = useState(false);
  const [model3DError, setModel3DError] = useState('');
  const [modelGenerationTime, setModelGenerationTime] = useState<number | null>(null);
  const [model3DSuccess, setModel3DSuccess] = useState('');

  // For coloring book generation
  const [coloringBookUrl, setColoringBookUrl] = useState('');
  const [generatingColoringBook, setGeneratingColoringBook] = useState(false);
  const [coloringBookError, setColoringBookError] = useState('');
  const [showColoringBookAdvanced, setShowColoringBookAdvanced] = useState(false);
  
  // Coloring book parameters for Anthropic workflow
  const [coloringBookThing, setColoringBookThing] = useState('');
  const [coloringBookAction, setColoringBookAction] = useState('');
  const [coloringBookNegativePrompt, setColoringBookNegativePrompt] = useState('');
  const [generatedColoringPrompt, setGeneratedColoringPrompt] = useState('');

  // For Anthropic prompt generation
  const [showPromptGenerator, setShowPromptGenerator] = useState(false);
  const [promptTemplate, setPromptTemplate] = useState('Create a prompt to create a 3D model of a {{object_type}} that is well lit, ready for a photo shoot with a blank, light gray background. In the style of {{style}}');
  const [promptVariables, setPromptVariables] = useState({ object_type: '', style: '' });
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [promptError, setPromptError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [serverError, setServerError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  // Image-to-image mode states
  const [generationMode, setGenerationMode] = useState<'text-to-image' | 'image-to-image'>('text-to-image');
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [inputImageFile, setInputImageFile] = useState<File | null>(null);
  const [inputImagePreview, setInputImagePreview] = useState<string | null>(null);
  
  // Image-to-image parameters
  const [img2imgStrength, setImg2imgStrength] = useState(0.8);
  const [img2imgGuidanceScale, setImg2imgGuidanceScale] = useState(7.5);
  const [img2imgInferenceSteps, setImg2imgInferenceSteps] = useState(50);
  const [showImg2ImgAdvanced, setShowImg2ImgAdvanced] = useState(false);

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Handle input image change for image-to-image mode
  const handleInputImageChange = async (file: File | null) => {
    setInputImageFile(file);
    if (file) {
      try {
        const base64 = await fileToBase64(file);
        setInputImage(base64);
        setInputImagePreview(base64);
      } catch (error) {
        console.error('Error converting file to base64:', error);
        setError('Failed to process the input image');
      }
    } else {
      setInputImage(null);
      setInputImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG] Form submitted with prompt:', prompt);
    
    setLoading(true);
    setError('');
    setDetailedError('');
    setShowErrorDetails(false);
    setImageUrl(''); // Clear the current image while loading
    setImageDetails(null); // Clear previous image details
    
    // Clear 3D model data
    setModelUrl('');
    setModel3DError('');
    setModelGenerationTime(null);
    
    // Clear coloring book data
    setColoringBookUrl('');
    setColoringBookError('');

    try {
      const startTime = Date.now();
      console.log('[DEBUG] Starting image generation at:', new Date().toISOString());
      
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[DEBUG] Request timeout triggered after 30 seconds');
        controller.abort();
      }, 30000); // 30 second timeout

      try {
        let apiEndpoint: string;
        let requestBody: any;

        if (generationMode === 'image-to-image') {
          // Validate input image for image-to-image mode
          if (!inputImage) {
            throw new Error('Please upload an input image for image-to-image generation');
          }
          
          console.log('[DEBUG] Sending fetch request to /api/image-to-image');
          apiEndpoint = '/api/image-to-image';
          
          // Prepare request body for image-to-image
          requestBody = {
            prompt,
            image: inputImage,
            strength: img2imgStrength,
            guidance_scale: img2imgGuidanceScale,
            num_inference_steps: img2imgInferenceSteps,
            ...(negativePrompt && { negative_prompt: negativePrompt }),
            ...(!useRandomSeed && seed !== null && { seed })
          };
        } else {
          // Text-to-image mode (existing functionality)
          console.log('[DEBUG] Sending fetch request to /api/generate-image');
          apiEndpoint = '/api/generate-image';
          
          // Prepare request body with advanced parameters
          requestBody = {
            prompt,
            aspect_ratio: aspectRatio,
            numberOfImages,
            ...(negativePrompt && { negativePrompt }),
            ...(personGeneration !== 'allow_adult' && { personGeneration }),
            ...(!useRandomSeed && seed !== null && { seed })
          };
        }
        
        console.log('[DEBUG] Request body:', { ...requestBody, image: requestBody.image ? '[BASE64_IMAGE_DATA]' : undefined });
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        // Clear the timeout
        clearTimeout(timeoutId);
        console.log('[DEBUG] Fetch completed, timeout cleared');

        console.log('[DEBUG] Response status:', response.status, response.statusText);
        
        if (!response.ok) {
          console.error('[DEBUG] Response not OK:', response.status, response.statusText);
          let errorText;
          try {
            errorText = await response.text();
            console.error('[DEBUG] Error response body:', errorText);
          } catch (textError) {
            console.error('[DEBUG] Failed to read error response text:', textError);
            errorText = 'Unknown error occurred';
          }
          throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }
        
        console.log('[DEBUG] Parsing response JSON');
        const data = await response.json() as ImageGenerationResponse;
        console.log('[DEBUG] Response data:', data);
        
        if ('error' in data) {
          console.error('[DEBUG] Error in response data:', data.error);
          throw new Error(data.error as string);
        }
        
        // Increment the image key to force a refresh of the image component
        setImageKey(prevKey => prevKey + 1);
        console.log('[DEBUG] Setting image URL:', data.imageUrl);
        setImageUrl(data.imageUrl);
        
        // Set image details with generation time calculated client-side
        const generationTime = (Date.now() - startTime) / 1000;
        console.log(`[DEBUG] Total generation time: ${generationTime.toFixed(2)} seconds`);
        setImageDetails({
          ...data,
          generationTime: generationTime // Convert to seconds
        });
      } catch (fetchError) {
        console.error('[DEBUG] Fetch error:', fetchError);
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. The server took too long to respond.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Error generating image:', error);
      setError('Error generating image');
      setDetailedError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Function to generate 3D model from the current image
  const generate3DModel = async () => {
    if (!imageUrl) {
      setModel3DError('Please generate an image first');
      return;
    }

    setGenerating3D(true);
    setModel3DError('');
    setServerError(null);

    try {
      console.log('Starting 3D model generation with image:', imageUrl);
      
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          prompt: prompt || "A detailed 3D model"
        }),
      });

      let data: ModelGenerationResponse;
      
      // Get the response text first to handle both JSON and plain text responses
      const responseText = await response.text();
      
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error('Failed to parse response as JSON:', jsonError);
        console.error('Raw error response:', responseText);
        setModel3DError('Invalid response from server. Please try again.');
        setServerError(`Server returned invalid JSON: ${responseText.substring(0, 100)}...`);
        setShowErrorDialog(true);
        return;
      }
      
      if (!response.ok) {
        console.error('Server error response:', data);
        setModel3DError(data.error || 'Failed to generate 3D model');
        setServerError(data.error || 'An unknown error occurred');
        setShowErrorDialog(true);
        return;
      }

      if (!data.modelUrl) {
        throw new Error('No model URL in response');
      }

      setModelUrl(data.modelUrl);
      console.log('3D model generated successfully:', data.modelUrl);
    } catch (error) {
      console.error('Error generating 3D model:', error);
      
      // Handle different types of errors with user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes('timed out') || error.message.includes('timeout') || error.message.includes('FUNCTION_INVOCATION_TIMEOUT')) {
          setModel3DError(
            '3D model generation timed out due to Vercel platform limits (45 seconds). Please try again - the model parameters have been optimized for faster generation.'
          );
        } else if (error.message.includes('invalid JSON') || error.message.includes('Server returned invalid JSON')) {
          setModel3DError(
            'The 3D generation service encountered an error. This is likely due to platform timeout limits. Please try again.'
          );
        } else {
          setModel3DError(error.message);
        }
        setServerError(error.message);
      } else {
        setModel3DError('Failed to generate 3D model');
        setServerError('An unexpected error occurred');
      }
      setShowErrorDialog(true);
    } finally {
      setGenerating3D(false);
    }
  };

  // Function to generate coloring book using Anthropic workflow
  const generateColoringBook = async () => {
    if (!coloringBookThing || !coloringBookAction) {
      setColoringBookError('Please enter both a subject and action for the coloring book');
      return;
    }

    setGeneratingColoringBook(true);
    setColoringBookError('');
    setGeneratedColoringPrompt('');

    try {
      console.log('Starting coloring book generation with Anthropic:', { 
        thing: coloringBookThing, 
        action: coloringBookAction 
      });
      
      const requestBody = {
        thing: coloringBookThing,
        action: coloringBookAction,
        ...(coloringBookNegativePrompt && { negativePrompt: coloringBookNegativePrompt })
      };

      console.log('Coloring book request body:', requestBody);
      
      const response = await fetch('/api/anthropic/coloring-book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate coloring book');
      }

      const data = await response.json();
      
      if (!data.imageUrl) {
        throw new Error('No coloring book image URL in response');
      }

      setColoringBookUrl(data.imageUrl);
      setGeneratedColoringPrompt(data.generatedPrompt);
      console.log('Coloring book generated successfully:', data.imageUrl);
      console.log('Generated prompt:', data.generatedPrompt);
    } catch (error) {
      console.error('Error generating coloring book:', error);
      setColoringBookError(error instanceof Error ? error.message : 'Failed to generate coloring book');
    } finally {
      setGeneratingColoringBook(false);
    }
  };

  // Function to save the image locally (bypass Firebase completely)
  const saveImageToFirebase = async () => {
    console.log('Starting saveImageToFirebase function (using local storage)');
    
    if (!imageUrl) {
      console.error('Cannot save: No image URL available');
      setSaveError('Cannot save image. Please generate an image first.');
      return;
    }
    
    if (!prompt) {
      console.error('Cannot save: No prompt available');
      setSaveError('Cannot save image. Prompt information is missing.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setSaveError('');

    try {
      console.log('Saving image to local storage...');
      
      // Create image data object
      const imageData = {
        id: Date.now().toString(),
        imageUrl,
        prompt,
        modelUrl: modelUrl || undefined,
        userId: user?.uid || 'anonymous',
        createdAt: new Date().toISOString()
      };
      
      // Get existing images from localStorage
      const existingImages = JSON.parse(localStorage.getItem('saved-images') || '[]');
      
      // Add new image to the beginning of the array
      existingImages.unshift(imageData);
      
      // Keep only the last 50 images to avoid storage bloat
      const limitedImages = existingImages.slice(0, 50);
      
      // Save back to localStorage
      localStorage.setItem('saved-images', JSON.stringify(limitedImages));
      
      console.log('Image saved successfully to local storage:', imageData.id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Clear success message after 3 seconds
      
    } catch (error) {
      console.error('Error saving image:', error);
      if (error instanceof Error) {
        setSaveError(`Failed to save image: ${error.message}`);
      } else {
        setSaveError('Failed to save image. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Clear function to reset all form values and clear the image
  const handleClear = () => {
    console.log('Clear button clicked');
    setPrompt('');
    setImageUrl('');
    setError('');
    setDetailedError('');
    setShowErrorDetails(false);
    setImageDetails(null);
    setModelUrl('');
    setModel3DError('');
    setModelGenerationTime(null);
    
    // Clear coloring book data
    setColoringBookUrl('');
    setColoringBookError('');
    setColoringBookThing('');
    setColoringBookAction('');
    setColoringBookNegativePrompt('');
    setGeneratedColoringPrompt('');
    
    // Clear image-to-image data
    setInputImage(null);
    setInputImageFile(null);
    setInputImagePreview(null);
    
    // Focus the prompt textarea after clearing
    setTimeout(() => {
      const promptTextarea = document.getElementById('prompt');
      if (promptTextarea) {
        promptTextarea.focus();
      }
    }, 0);
  };

  // Regenerate function to generate a new image with the same prompt
  const handleRegenerate = () => {
    console.log('Regenerate button clicked');
    if (prompt.trim()) {
      // Force a new seed if using random seed
      if (useRandomSeed) {
        setSeed(Math.floor(Math.random() * 1000000));
      }
      
      // Create a synthetic form event that can be safely passed to handleSubmit
      const syntheticEvent = {
        preventDefault: () => {},
      } as React.FormEvent;
      
      handleSubmit(syntheticEvent);
    }
  };

  // Function to generate a random seed
  const generateRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
    setUseRandomSeed(false);
  };

  // Function to clear coloring book inputs
  const clearColoringBookInputs = () => {
    setColoringBookThing('');
    setColoringBookAction('');
    setColoringBookNegativePrompt('');
    setGeneratedColoringPrompt('');
  };

  // Function to generate prompt with Anthropic
  const generatePromptWithAnthropic = async () => {
    if (!promptTemplate.trim()) {
      setPromptError('Please enter a prompt template');
      return;
    }

    setGeneratingPrompt(true);
    setPromptError('');

    try {
      console.log('Starting prompt generation with Anthropic');
      
      const response = await fetch('/api/anthropic/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: promptTemplate,
          variables: promptVariables
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate prompt');
      }

      const data = await response.json();
      
      if (!data.generatedPrompt) {
        throw new Error('No prompt generated');
      }

      setGeneratedPrompt(data.generatedPrompt);
      console.log('Prompt generated successfully:', data.generatedPrompt);
    } catch (error) {
      console.error('Error generating prompt:', error);
      setPromptError(error instanceof Error ? error.message : 'Failed to generate prompt');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  // Function to use generated prompt
  const useGeneratedPrompt = () => {
    if (generatedPrompt) {
      setPrompt(generatedPrompt);
      // Close the prompt generator
      setShowPromptGenerator(false);
      // Focus the main prompt textarea
      setTimeout(() => {
        const promptTextarea = document.getElementById('prompt');
        if (promptTextarea) {
          promptTextarea.focus();
        }
      }, 100);
    }
  };

  // Function to update prompt variables
  const updatePromptVariable = (key: string, value: string) => {
    setPromptVariables(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="max-w-6xl mx-auto relative">
      {/* Background gradient elements */}
      <div className="absolute top-20 -left-10 w-64 h-64 bg-blue-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute top-40 right-10 w-72 h-72 bg-purple-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-pink-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      
      <div className="relative z-10 bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text">
              AI Image & 3D Generator
            </h1>
            <p className="text-slate-400 mt-2">Create stunning images and 3D models with a simple prompt</p>
          </div>
          
          <div className="flex items-center space-x-2 bg-slate-900/70 px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 self-start">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>AI Processing Ready</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-lg -rotate-1 scale-[1.01] opacity-70"></div>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to create..."
              className="w-full p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-100 relative z-10 placeholder-slate-500"
              rows={3}
            />
          </div>

          {/* Generation Mode Toggle */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-300">Generation Mode</h3>
            </div>
            
            <div className="flex bg-slate-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setGenerationMode('text-to-image')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  generationMode === 'text-to-image'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Text to Image
              </button>
              <button
                type="button"
                onClick={() => setGenerationMode('image-to-image')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  generationMode === 'image-to-image'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Image to Image
              </button>
            </div>

            {/* Image Upload for Image-to-Image Mode */}
            {generationMode === 'image-to-image' && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Input Image
                  </label>
                  {inputImagePreview ? (
                    <div className="relative">
                      <img
                        src={inputImagePreview}
                        alt="Input"
                        className="w-full h-48 object-cover rounded-lg border border-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleInputImageChange(null)}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full transition-colors"
                      >
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-600 rounded-lg p-6">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleInputImageChange(e.target.files?.[0] || null)}
                        className="hidden"
                        id="input-image-upload"
                      />
                      <label
                        htmlFor="input-image-upload"
                        className="cursor-pointer flex flex-col items-center justify-center text-center"
                      >
                        <svg className="w-12 h-12 text-slate-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-slate-400 mb-1">Click to upload an image</p>
                        <p className="text-xs text-slate-500">PNG, JPG, GIF up to 10MB</p>
                      </label>
                    </div>
                  )}
                </div>

                {/* Image-to-Image Advanced Controls */}
                <button
                  type="button"
                  onClick={() => setShowImg2ImgAdvanced(!showImg2ImgAdvanced)}
                  className="flex items-center justify-between w-full text-slate-300 hover:text-white transition-colors"
                >
                  <span className="text-sm font-medium">Image-to-Image Settings</span>
                  <svg className={`w-4 h-4 transition-transform ${showImg2ImgAdvanced ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {showImg2ImgAdvanced && (
                  <div className="space-y-4 border-t border-slate-700 pt-4">
                    {/* Strength */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Strength: {img2imgStrength}
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={img2imgStrength}
                        onChange={(e) => setImg2imgStrength(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        How much to transform the original image (0.1 = subtle, 1.0 = dramatic)
                      </p>
                    </div>

                    {/* Guidance Scale */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Guidance Scale: {img2imgGuidanceScale}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.5"
                        value={img2imgGuidanceScale}
                        onChange={(e) => setImg2imgGuidanceScale(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        How closely to follow the prompt (higher = more adherence)
                      </p>
                    </div>

                    {/* Inference Steps */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Inference Steps: {img2imgInferenceSteps}
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={img2imgInferenceSteps}
                        onChange={(e) => setImg2imgInferenceSteps(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Number of processing steps (higher = better quality, slower)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Prompt Generator Section */}
          <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-purple-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-semibold text-purple-300">AI Prompt Generator</h3>
              </div>
              <div className="bg-purple-900 rounded-lg px-3 py-1 text-xs font-medium text-purple-300 flex items-center border border-purple-700">
                <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 10-2 0 1 1 0 002 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Claude AI
              </div>
            </div>
            
            <p className="text-sm text-slate-400">
              Use Claude AI to generate detailed, professional prompts for your image generation.
            </p>

            <button
              type="button"
              onClick={() => setShowPromptGenerator(!showPromptGenerator)}
              className="w-full bg-purple-900/60 border border-purple-700/60 text-purple-200 font-medium py-2 px-4 rounded-lg hover:bg-purple-800/60 transition-all text-sm"
            >
              {showPromptGenerator ? 'Hide Prompt Generator' : 'Open Prompt Generator'}
            </button>

            {showPromptGenerator && (
              <div className="space-y-4 border-t border-purple-700/50 pt-4">
                {/* Template Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Prompt Template
                  </label>
                  <textarea
                    value={promptTemplate}
                    onChange={(e) => setPromptTemplate(e.target.value)}
                    placeholder="Create a prompt to create a 3D model of a {{object_type}} that is well lit, ready for a photo shoot with a blank, light gray background. In the style of {{style}}"
                    className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-slate-500"
                    rows={3}
                  />
                  <p className="text-xs text-slate-500 mt-1">Use {`{{variable_name}}`} for dynamic variables</p>
                </div>

                {/* Variables Section */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Variables
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Object Type</label>
                      <input
                        type="text"
                        value={promptVariables.object_type}
                        onChange={(e) => updatePromptVariable('object_type', e.target.value)}
                        placeholder="e.g., sports car, dragon, castle"
                        className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Style</label>
                      <input
                        type="text"
                        value={promptVariables.style}
                        onChange={(e) => updatePromptVariable('style', e.target.value)}
                        placeholder="e.g., futuristic, medieval, minimalist"
                        className="w-full p-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-slate-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={generatePromptWithAnthropic}
                  disabled={generatingPrompt || !promptTemplate.trim()}
                  className="w-full bg-purple-900/60 border border-purple-700/60 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:bg-purple-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPrompt ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating with Claude AI...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      Generate Professional Prompt
                    </span>
                  )}
                </button>

                {/* Error Display */}
                {promptError && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-400 flex items-center">
                      <svg className="w-4 h-4 mr-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {promptError}
                    </p>
                  </div>
                )}

                {/* Generated Prompt Display */}
                {generatedPrompt && (
                  <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-green-300">Generated Prompt</h4>
                      <button
                        type="button"
                        onClick={useGeneratedPrompt}
                        className="px-3 py-1 bg-green-700 hover:bg-green-600 text-green-100 text-xs rounded-lg transition-colors"
                      >
                        Use This Prompt
                      </button>
                    </div>
                    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 max-h-32 overflow-y-auto">
                      <p className="text-sm text-slate-200 whitespace-pre-wrap">{generatedPrompt}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Advanced Controls */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 space-y-4">
            <button
              type="button"
              onClick={() => setShowAdvancedControls(!showAdvancedControls)}
              className="flex items-center justify-between w-full text-slate-300 hover:text-white transition-colors"
            >
              <span className="font-medium flex items-center">
                <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.532 1.532 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.532 1.532 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Advanced Controls
              </span>
              <svg className={`w-4 h-4 transition-transform ${showAdvancedControls ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {showAdvancedControls && (
              <div className="space-y-6">
                {/* Quick Style Tags */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-300">Quick Style Tags</label>
                    <button
                      type="button"
                      onClick={() => setShowStyleButtons(!showStyleButtons)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {showStyleButtons ? 'Hide' : 'Show'} Styles
                    </button>
                  </div>
                  {showStyleButtons && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { label: 'Photorealistic', tag: 'photorealistic, 4K HDR' },
                        { label: 'Oil Painting', tag: 'oil painting style' },
                        { label: 'Watercolor', tag: 'watercolor painting' },
                        { label: 'Digital Art', tag: 'digital art, concept art' },
                        { label: 'Anime Style', tag: 'anime style, manga' },
                        { label: 'Vintage Photo', tag: 'vintage photography, film grain' },
                        { label: 'Minimalist', tag: 'minimalist, clean, simple' },
                        { label: 'Cyberpunk', tag: 'cyberpunk, neon, futuristic' },
                        { label: 'Fantasy Art', tag: 'fantasy art, magical' },
                        { label: 'Pop Art', tag: 'pop art, bold colors' },
                        { label: 'Impressionist', tag: 'impressionist painting style' },
                        { label: 'Art Deco', tag: 'art deco style, geometric' }
                      ].map((style) => (
                        <button
                          key={style.label}
                          type="button"
                          onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + style.tag)}
                          className="px-3 py-2 text-xs bg-slate-800 text-slate-300 rounded-md hover:bg-slate-700 hover:text-white transition-colors border border-slate-600"
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Photography Controls */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-300">Photography Modifiers</label>
                    <button
                      type="button"
                      onClick={() => setShowPhotographyControls(!showPhotographyControls)}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {showPhotographyControls ? 'Hide' : 'Show'} Camera
                    </button>
                  </div>
                  {showPhotographyControls && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Camera Angle</label>
                          <div className="grid grid-cols-2 gap-1">
                            {['close-up', 'wide shot', 'aerial view', 'from below'].map((angle) => (
                              <button
                                key={angle}
                                type="button"
                                onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + angle)}
                                className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                              >
                                {angle}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Lighting</label>
                          <div className="grid grid-cols-2 gap-1">
                            {['golden hour', 'dramatic lighting', 'soft lighting', 'neon lighting'].map((light) => (
                              <button
                                key={light}
                                type="button"
                                onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + light)}
                                className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                              >
                                {light}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Lens Type</label>
                          <div className="grid grid-cols-2 gap-1">
                            {['macro lens', 'wide angle', 'fisheye', '35mm'].map((lens) => (
                              <button
                                key={lens}
                                type="button"
                                onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + lens)}
                                className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                              >
                                {lens}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quality & Creativity Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Quality Level</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { value: 'standard', label: 'Standard' },
                        { value: 'high', label: 'High Quality', tag: '4K, HDR, professional' },
                        { value: 'ultra', label: 'Ultra HD', tag: '8K, ultra detailed, masterpiece' }
                      ].map((quality) => (
                        <button
                          key={quality.value}
                          type="button"
                          onClick={() => {
                            setQualityLevel(quality.value);
                            if (quality.tag) {
                              setPrompt(prev => prev + (prev ? ', ' : '') + quality.tag);
                            }
                          }}
                          className={`px-3 py-2 text-xs rounded-md transition-colors border ${
                            qualityLevel === quality.value
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                          }`}
                        >
                          {quality.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Creative Style</label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { value: 'realistic', label: 'Realistic', tag: 'photorealistic, natural' },
                        { value: 'balanced', label: 'Balanced' },
                        { value: 'artistic', label: 'Artistic', tag: 'creative, stylized, artistic' }
                      ].map((creativity) => (
                        <button
                          key={creativity.value}
                          type="button"
                          onClick={() => {
                            setCreativityLevel(creativity.value);
                            if (creativity.tag) {
                              setPrompt(prev => prev + (prev ? ', ' : '') + creativity.tag);
                            }
                          }}
                          className={`px-3 py-2 text-xs rounded-md transition-colors border ${
                            creativityLevel === creativity.value
                              ? 'bg-purple-600 text-white border-purple-500'
                              : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                          }`}
                        >
                          {creativity.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Material & Texture Quick Tags */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Materials & Effects</label>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {[
                      'made of glass',
                      'made of metal',
                      'made of wood',
                      'glowing',
                      'transparent',
                      'reflective',
                      'textured',
                      'smooth',
                      'crystalline',
                      'organic',
                      'geometric',
                      'flowing'
                    ].map((material) => (
                      <button
                        key={material}
                        type="button"
                        onClick={() => setPrompt(prev => prev + (prev ? ', ' : '') + material)}
                        className="px-2 py-1 text-xs bg-slate-800 text-slate-300 rounded hover:bg-slate-700 hover:text-white transition-colors border border-slate-600"
                      >
                        {material}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Existing aspect ratio, number of images, etc. controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: '1:1', label: 'Square', desc: '1024×1024' },
                        { value: '4:3', label: 'Landscape', desc: '1152×896' },
                        { value: '3:4', label: 'Portrait', desc: '896×1152' },
                        { value: '16:9', label: 'Wide', desc: '1344×768' },
                        { value: '9:16', label: 'Tall', desc: '768×1344' }
                      ].map((ratio) => (
                        <button
                          key={ratio.value}
                          type="button"
                          onClick={() => setAspectRatio(ratio.value)}
                          className={`p-2 text-xs rounded-md transition-colors border ${
                            aspectRatio === ratio.value
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                          }`}
                        >
                          <div className="font-medium">{ratio.label}</div>
                          <div className="text-xs opacity-75">{ratio.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Number of Images</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setNumberOfImages(num)}
                          className={`flex-1 py-2 text-sm rounded-md transition-colors border ${
                            numberOfImages === num
                              ? 'bg-green-600 text-white border-green-500'
                              : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Negative Prompt */}
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">
                    Negative Prompt
                    <span className="text-xs text-slate-400 ml-2">(What to avoid)</span>
                  </label>
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="e.g., blurry, low quality, distorted, ugly..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={2}
                  />
                </div>

                {/* Person Generation & Seed Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Person Generation</label>
                    <select
                      value={personGeneration}
                      onChange={(e) => setPersonGeneration(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="allow_adult">Allow Adults</option>
                      <option value="allow_minor">Allow Minors</option>
                      <option value="block_all">Block All People</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Seed Control</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setUseRandomSeed(!useRandomSeed)}
                        className={`px-3 py-2 text-xs rounded-md transition-colors border ${
                          useRandomSeed
                            ? 'bg-orange-600 text-white border-orange-500'
                            : 'bg-slate-800 text-slate-300 border-slate-600'
                        }`}
                      >
                        Random
                      </button>
                      <input
                        type="number"
                        value={seed || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSeed(value ? parseInt(value) : null);
                          setUseRandomSeed(false);
                        }}
                        placeholder="Seed"
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={useRandomSeed}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 items-center">
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex-1 btn-gradient text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : 'Generate Image'}
            </button>
            
            <button
              type="button"
              onClick={handleRegenerate}
              className="bg-purple-900/40 border border-purple-700/50 text-purple-300 py-3 px-6 rounded-lg hover:bg-purple-800/40 shadow-sm transition-colors flex items-center space-x-2"
              disabled={loading || !prompt.trim() || !imageUrl}
              title="Generate a new variation with the same prompt"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Regenerate</span>
            </button>
            
            <button
              type="button"
              onClick={handleClear}
              className="bg-slate-900 border border-slate-700 text-slate-300 py-3 px-6 rounded-lg hover:bg-slate-800 shadow-sm transition-colors flex items-center space-x-2"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v4.586l.293-.293a1 1 0 011.414 1.414l-2 2a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414l.293.293V3a1 1 0 011-1z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h4.586l-.293-.293a1 1 0 111.414-1.414l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414-1.414l.293-.293H4a1 1 0 01-1-1z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M12.146 4.646a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414-1.414l.293-.293H8a1 1 0 110-2h4.439l-.293-.293a1 1 0 010-1.414z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M16 16a1 1 0 01-1 1H4.439l.293.293a1 1 0 11-1.414 1.414l-2-2a1 1 0 010-1.414l2-2a1 1 0 111.414 1.414L4.44 15H15a1 1 0 011 1z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </form>

        {/* AI Coloring Book Creator - Standalone Section */}
        <div className="mb-8 bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-100">AI Coloring Book Creator</h3>
              <div className="bg-slate-900 rounded-lg px-3 py-1 text-xs font-medium text-purple-400 flex items-center border border-slate-700">
                <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 10-2 0 1 1 0 002 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Claude AI
              </div>
            </div>
            
            <p className="text-sm text-slate-400 mb-4">
              Use Claude AI to generate custom coloring book pages from your ideas. Perfect for kids and creative projects.
            </p>
            
            {/* Anthropic Coloring Book Inputs */}
            <div className="space-y-4 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Subject (What to draw)
                  </label>
                  <input
                    type="text"
                    value={coloringBookThing}
                    onChange={(e) => setColoringBookThing(e.target.value)}
                    placeholder="e.g., cat, dragon, castle, flower"
                    className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-slate-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Action (What it's doing)
                  </label>
                  <input
                    type="text"
                    value={coloringBookAction}
                    onChange={(e) => setColoringBookAction(e.target.value)}
                    placeholder="e.g., sitting, flying, dancing, sleeping"
                    className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-slate-500"
                  />
                </div>
              </div>

              {/* Negative Prompt for Coloring Book */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Negative Prompt 
                  <span className="text-xs text-slate-400 ml-2">(What to avoid)</span>
                </label>
                <textarea
                  value={coloringBookNegativePrompt}
                  onChange={(e) => setColoringBookNegativePrompt(e.target.value)}
                  placeholder="e.g., text, words, complex details, realistic faces..."
                  className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-slate-500 resize-none"
                  rows={2}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Additional items to exclude from the coloring book (automatically excludes colors and shading)
                </p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Claude AI will generate a detailed coloring book prompt
                </p>
                {(coloringBookThing || coloringBookAction || coloringBookNegativePrompt) && (
                  <button
                    type="button"
                    onClick={clearColoringBookInputs}
                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Clear inputs
                  </button>
                )}
              </div>

              {generatedColoringPrompt && (
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-orange-300 mb-2">Generated Prompt</h4>
                  <p className="text-sm text-slate-300">{generatedColoringPrompt}</p>
                </div>
              )}
            </div>
            
            <button
              onClick={generateColoringBook}
              disabled={generatingColoringBook || !coloringBookThing || !coloringBookAction}
              className={`${generatingColoringBook || !coloringBookThing || !coloringBookAction ? 'opacity-50 cursor-not-allowed' : ''} w-full bg-orange-900/60 border border-orange-700/60 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:bg-orange-800/60 transition-all`}
            >
              {generatingColoringBook ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Coloring Book with Claude AI...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zM3 15a1 1 0 011-1h1a1 1 0 011 1v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-1zm6-11a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zm6 3a1 1 0 011-1h1a1 1 0 011 1v7a1 1 0 01-1 1h-1a1 1 0 01-1-1V7z" clipRule="evenodd" />
                  </svg>
                  Generate Coloring Book
                </span>
              )}
            </button>
            
            {(!coloringBookThing || !coloringBookAction) && (
              <div className="flex items-center text-xs text-orange-400">
                <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Please enter both subject and action
              </div>
            )}
            
            {coloringBookError && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-400 flex items-center">
                  <svg className="w-4 h-4 mr-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {coloringBookError}
                </p>
              </div>
            )}
          </div>
          
          {coloringBookUrl && (
            <div className="space-y-4 p-6 bg-slate-900 border-t border-slate-700">
              <div className="relative group overflow-hidden rounded-lg shadow-lg border border-slate-700">
                <Image
                  src={coloringBookUrl}
                  alt="Generated coloring book image"
                  width={400}
                  height={400}
                  className="w-full h-auto object-contain bg-white"
                />
              </div>
              
              <button 
                onClick={() => downloadFile(coloringBookUrl, generateFilename(`${coloringBookThing} ${coloringBookAction}`, 'coloring'))}
                className="block w-full bg-orange-900/60 border border-orange-700/60 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:bg-orange-800/60 text-center transition-all"
              >
                <span className="flex items-center justify-center">
                  <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 00-1.414-1.414L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download Coloring Book
                </span>
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-8 overflow-hidden rounded-lg border border-red-900">
            <div className="bg-red-900/30 px-4 py-3 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-red-400 font-medium">{error}</p>
              </div>
              
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="text-sm text-red-400 hover:text-red-300 font-medium underline"
              >
                {showErrorDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            
            {showErrorDetails && (
              <div className="bg-slate-900 px-4 py-3 border-t border-red-900/50">
                <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap overflow-auto max-h-40">{detailedError}</pre>
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex justify-center items-center py-16 mb-8">
            <div className="text-center">
              <div className="relative">
                <div className="w-20 h-20 mb-4 mx-auto rounded bg-gradient-to-tr from-blue-500 to-purple-600 animate-pulse blur-sm opacity-75 absolute inset-0"></div>
                <div className="w-20 h-20 mb-4 mx-auto rounded bg-slate-900 backdrop-blur flex items-center justify-center relative z-10">
                  <svg className="w-10 h-10 text-blue-500 animate-float" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-blue-400 font-semibold">Creating your masterpiece...</p>
              <p className="text-slate-500 text-sm mt-1">This usually takes 5-15 seconds</p>
            </div>
          </div>
        )}

        {imageUrl && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-4">
            <div className="lg:col-span-3 space-y-6">
              <div className="relative group overflow-hidden rounded-lg shadow-lg border border-slate-700 neon-glow">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/10 to-purple-600/10 backdrop-blur-sm"></div>
                <Image
                  key={imageKey}
                  src={imageUrl}
                  alt="Generated image"
                  width={800}
                  height={600}
                  className="relative z-10 w-full h-auto object-contain"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black to-transparent p-4 transform translate-y-full group-hover:translate-y-0 transition-transform">
                  <p className="text-slate-200 font-medium truncate">{prompt}</p>
                </div>
              </div>
              
              <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-sm p-5 space-y-4">
                <h3 className="text-lg font-semibold text-slate-200 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 10-2 0 1 1 0 002 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Image Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-slate-400">Model</p>
                    <p className="font-medium text-slate-300">{imageDetails?.model || 'Google Imagen-4-Fast'}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Aspect Ratio</p>
                    <p className="font-medium text-slate-300">{aspectRatio}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Resolution</p>
                    <p className="font-medium text-slate-300">
                      {aspectRatio === '1:1' && '1024×1024'}
                      {aspectRatio === '4:3' && '1280×896'}
                      {aspectRatio === '3:4' && '896×1280'}
                      {aspectRatio === '16:9' && '1408×768'}
                      {aspectRatio === '9:16' && '768×1408'}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Images Generated</p>
                    <p className="font-medium text-slate-300">{numberOfImages}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Generation Time</p>
                    <p className="font-medium text-slate-300">
                      {imageDetails?.generationTime ? 
                        `${imageDetails.generationTime.toFixed(2)} seconds` : 
                        'Unknown'}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Seed</p>
                    <p className="font-medium text-slate-300">
                      {useRandomSeed ? 'Random' : (seed || 'Random')}
                    </p>
                  </div>
                  
                  {negativePrompt && (
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-slate-400">Negative Prompt</p>
                      <p className="font-medium text-slate-300 text-xs">{negativePrompt}</p>
                    </div>
                  )}
                  
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-slate-400">Prompt</p>
                    <p className="font-medium text-slate-300">{prompt}</p>
                  </div>
                </div>

                {/* Regenerate Button */}
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={handleRegenerate}
                    disabled={loading || !prompt.trim()}
                    className="w-full bg-purple-900/60 border border-purple-700/60 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:bg-purple-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-3"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Regenerating...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        Regenerate with Same Settings
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Save Image Button */}
                <div className="pt-4 border-t border-slate-700">
                  <button
                    onClick={saveImageToFirebase}
                    disabled={saving}
                    className="w-full bg-blue-900/60 border border-blue-700/60 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:bg-blue-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                        </svg>
                        Save Image
                      </span>
                    )}
                  </button>
                  
                  {saveSuccess && (
                    <div className="mt-2 p-2 bg-green-900/30 border border-green-800 rounded-lg">
                      <p className="text-sm text-green-400 flex items-center">
                        <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Image saved successfully!
                      </p>
                    </div>
                  )}
                  
                  {saveError && (
                    <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded-lg">
                      <p className="text-sm text-red-400 flex items-center">
                        <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {saveError}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Download Image Button */}
                <div className="pt-4 border-t border-slate-700">
                  <button 
                    onClick={() => downloadFile(imageUrl, generateFilename(prompt, 'image'))}
                    className="block w-full bg-green-900/60 border border-green-700/60 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:bg-green-800/60 text-center transition-all"
                  >
                    <span className="flex items-center justify-center">
                      <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 00-1.414-1.414L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Download Image
                    </span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-6">
              {/* 3D Model Generation Section */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-lg shadow-sm overflow-hidden">
                <div className="p-6 space-y-5">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-100">3D Model Creator</h3>
                    <div className="bg-slate-900 rounded-lg px-3 py-1 text-xs font-medium text-purple-400 flex items-center border border-slate-700">
                      <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                      Hunyuan3D-2
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-400 mb-4">
                    Transform your image into a detailed 3D model with Tencent&apos;s advanced Hunyuan3D-2 technology.
                  </p>
                  
                  <button
                    onClick={generate3DModel}
                    disabled={generating3D || !prompt.trim()}
                    className={`${generating3D ? 'opacity-50 cursor-not-allowed' : ''} w-full btn-gradient text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all`}
                  >
                    {generating3D ? (
                      <span className="flex items-center justify-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating 3D with Hunyuan3D-2...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <Box className="w-4 h-4 mr-2" />
                        Generate 3D Model
                      </span>
                    )}
                  </button>
                  
                  {!prompt.trim() && (
                    <div className="flex items-center text-xs text-red-400">
                      <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Please enter a prompt first
                    </div>
                  )}
                  
                  {model3DError && (
                    <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                      <p className="text-sm text-red-400 flex items-center">
                        <svg className="w-4 h-4 mr-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {model3DError}
                      </p>
                    </div>
                  )}
                  
                  {model3DSuccess && (
                    <div className="bg-green-900/30 border border-green-800 rounded-lg p-3">
                      <p className="text-sm text-green-400 flex items-center">
                        <svg className="w-4 h-4 mr-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {model3DSuccess}
                      </p>
                    </div>
                  )}
                  
                  {generating3D && (
                    <div className="flex justify-center items-center py-6">
                      <div className="text-center">
                        <div className="relative">
                          <div className="w-16 h-16 mb-4 mx-auto rounded bg-gradient-to-tr from-blue-500 to-purple-600 animate-pulse blur-sm absolute inset-0"></div>
                          <div className="w-16 h-16 mb-4 mx-auto rounded bg-slate-900 backdrop-blur flex items-center justify-center relative z-10">
                            <svg className="w-8 h-8 text-blue-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                            </svg>
                          </div>
                        </div>
                        <p className="text-blue-400 font-medium text-sm">Creating 3D model...</p>
                        <p className="text-slate-500 text-xs mt-1">This may take a few minutes</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {modelUrl && !generating3D && (
                  <div className="space-y-4 p-6 bg-slate-900 border-t border-slate-700">
                    <ModelViewer
                      src={modelUrl}
                      alt={`3D model generated from image with prompt: ${prompt}`}
                      poster={imageUrl}
                      className="rounded-lg overflow-hidden border border-slate-700 shadow-sm"
                    />
                    
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm">
                      <h4 className="font-semibold text-slate-200 mb-3">3D Model Details</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-blue-400 text-xs mb-1">Generation Time</p>
                          <p className="font-medium text-slate-300">
                            {modelGenerationTime ? `${modelGenerationTime.toFixed(2)}s` : 'Unknown'}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-blue-400 text-xs mb-1">Format</p>
                          <p className="font-medium text-slate-300">GLB</p>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => downloadFile(modelUrl, generateFilename(prompt, '3d'))}
                      className="block w-full btn-gradient text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg text-center transition-all"
                    >
                      <span className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 00-1.414-1.414L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download 3D Model
                      </span>
                    </button>
                    
                    {/* Save to My Models button - now positioned below 3D model */}
                    {modelUrl && !generating3D && (
                      <div className="mt-4">
                        <button
                          onClick={saveImageToFirebase}
                          disabled={saving}
                          className="block w-full bg-purple-900/60 border border-purple-700/60 text-white font-medium py-3 px-6 rounded-lg shadow-md hover:bg-purple-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? (
                            <span className="flex items-center justify-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </span>
                          ) : (
                            <span className="flex items-center justify-center">
                              <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                              </svg>
                              Save to My Models
                            </span>
                          )}
                        </button>
                        
                        {saveSuccess && (
                          <div className="mt-2 p-2 bg-green-900/30 border border-green-800 rounded-lg">
                            <p className="text-sm text-green-400 flex items-center">
                              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Image and 3D model saved to My Models
                            </p>
                          </div>
                        )}
                        
                        {saveError && (
                          <div className="mt-2 p-2 bg-red-900/30 border border-red-800 rounded-lg">
                            <p className="text-sm text-red-400 flex items-center">
                              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              {saveError}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Add floating decorative elements */}
      <div className="absolute -bottom-10 right-20 w-20 h-20 bg-blue-500/20 rounded-lg rotate-12 opacity-30 z-0"></div>
      <div className="absolute top-40 -left-10 w-16 h-16 bg-purple-500/20 rounded-lg rotate-45 opacity-30 z-0"></div>

      {/* Error Dialog */}
      {showErrorDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl border border-slate-700">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-semibold text-red-400">Error Details</h3>
              <button
                onClick={() => setShowErrorDialog(false)}
                className="text-slate-400 hover:text-slate-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-slate-300 font-mono text-sm whitespace-pre-wrap">
                  {serverError || 'No error details available'}
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowErrorDialog(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowErrorDialog(false);
                    setServerError(null);
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                >
                  Clear Error
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 