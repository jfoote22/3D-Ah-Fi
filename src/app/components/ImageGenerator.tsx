'use client';

import { useState } from 'react';
import Image from 'next/image';
import ModelViewer from './ModelViewer';
import { useAuth } from '@/lib/hooks/useAuth';
import { storage } from '@/lib/firebase/firebase';
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

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
}

interface ModelGenerationResponse {
  modelUrl: string;
  generationTime?: number;
  sourceImageUrl?: string;
  prompt?: string;
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
  
  // For 3D model generation
  const [modelUrl, setModelUrl] = useState('');
  const [generating3D, setGenerating3D] = useState(false);
  const [model3DError, setModel3DError] = useState('');
  const [modelGenerationTime, setModelGenerationTime] = useState<number | null>(null);
  const [model3DSuccess, setModel3DSuccess] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with prompt:', prompt);
    
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

    try {
      const startTime = Date.now();
      
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
          signal: controller.signal
        });

        // Clear the timeout
        clearTimeout(timeoutId);

        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }
        
        const data = await response.json() as ImageGenerationResponse;
        console.log('Response data:', data);
        
        if ('error' in data) {
          throw new Error(data.error as string);
        }
        
        // Increment the image key to force a refresh of the image component
        setImageKey(prevKey => prevKey + 1);
        setImageUrl(data.imageUrl);
        
        // Set image details with generation time calculated client-side
        setImageDetails({
          ...data,
          generationTime: (Date.now() - startTime) / 1000 // Convert to seconds
        });
      } catch (fetchError) {
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
    if (!prompt || !prompt.trim()) {
      setModel3DError('Please provide a prompt for 3D model generation');
      return;
    }

    setGenerating3D(true);
    setModel3DError('');
    setModelUrl('');
    setModelGenerationTime(null);

    try {
      console.log('Starting 3D model generation with prompt:', prompt);
      
      // Add timeout to fetch request - note this is a client-side timeout
      // The server also has its own timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      const startTime = Date.now();
      
      // Status tracking for debugging
      let lastStatusLog = Date.now();
      const statusInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`[Client] Still waiting for 3D model after ${elapsedTime.toFixed(0)} seconds...`);
      }, 5000); // Log every 5 seconds

      try {
        console.log('[Client] Sending request to generate-3d API...');
        
        const response = await fetch('/api/generate-3d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: prompt,
            imageUrl: imageUrl // Optional for Hunyuan3D-2, but including for context
          }),
          signal: controller.signal
        }).catch(fetchError => {
          // Handle abort/timeout specifically
          if (fetchError.name === 'AbortError') {
            clearInterval(statusInterval);
            throw new Error('Request timed out. 3D model generation takes time, please try again with a simpler prompt or image.');
          }
          throw fetchError;
        });
        
        // Clear tracking
        clearTimeout(timeoutId);
        clearInterval(statusInterval);
        
        console.log('[Client] Received response:', response.status, response.statusText);

        // For debugging - log non-2xx responses
        if (!response.ok) {
          console.error(`[Client] Server error status: ${response.status}`);
          try {
            // Try to extract detailed error information
            const errorData = await response.json();
            console.error('[Client] Server error details:', errorData);
            
            // Check for timeout status
            if (response.status === 504) {
              throw new Error(
                errorData.error || 
                '3D model generation timed out. The Hunyuan3D-2 model requires 2-3 minutes to generate complex models. Please try again with a simpler prompt or image.'
              );
            }
            
            // If we have detailed error with currentStep, show it to help debugging
            if (errorData.currentStep) {
              throw new Error(`Error during ${errorData.currentStep}: ${errorData.error || 'Unknown error'}`);
            }
            
            throw new Error(`Server responded with ${response.status}: ${errorData.error || response.statusText}`);
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message.includes('currentStep')) {
              throw parseError; // Re-throw the parsed error with step info
            }
            // If we can't parse the response, just use the status text
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
          }
        }

        console.log('[Client] Parsing response JSON...');
        const data = await response.json() as ModelGenerationResponse;
        console.log('[Client] 3D generation response:', data);

        if ('error' in data) {
          throw new Error(data.error as string);
        }

        if (!data.modelUrl) {
          throw new Error('No model URL returned from the server');
        }

        setModelUrl(data.modelUrl);
        if (data.generationTime) {
          setModelGenerationTime(data.generationTime);
        }
        
        // Set success message
        setModel3DSuccess('3D model generated successfully!');
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setModel3DSuccess('');
        }, 5000);
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        clearInterval(statusInterval);
        throw fetchError;
      }
    } catch (error) {
      console.error('Error generating 3D model:', error);
      
      // Handle different types of errors with user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes('timed out') || error.message.includes('timeout')) {
          setModel3DError(
            'The 3D model generation timed out. The Hunyuan3D-2 model requires 2-3 minutes for complex images. ' +
            'Please try again with a simpler prompt or image.'
          );
        } else {
          setModel3DError(error.message);
        }
      } else {
        setModel3DError('Failed to generate 3D model');
      }
    } finally {
      setGenerating3D(false);
    }
  };

  // Function to save the image to Firebase
  const saveImageToFirebase = async () => {
    console.log('Starting saveImageToFirebase function');
    
    if (!user) {
      console.error('Cannot save: No authenticated user');
      setSaveError('Cannot save image. Please log in first.');
      return;
    }
    
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
      console.log('Creating unique filename for image');
      // Create a unique filename
      const timestamp = new Date().getTime();
      const filename = `images/${user.uid}/${timestamp}_${prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '_')}.jpg`;
      
      // Convert imageUrl to blob if it's a remote URL or upload directly if it's a data URL
      let downloadUrl = '';
      
      if (imageUrl.startsWith('data:')) {
        console.log('Image is a data URL, uploading to Firebase Storage');
        // It's a data URL, upload directly
        const imageStorageRef = storageRef(storage, filename);
        const snapshot = await uploadString(imageStorageRef, imageUrl, 'data_url');
        downloadUrl = await getDownloadURL(snapshot.ref);
        console.log('Image uploaded to Firebase Storage successfully, URL:', downloadUrl.substring(0, 50) + '...');
      } else {
        console.log('Image is a remote URL, storing the URL directly:', imageUrl.substring(0, 50) + '...');
        // It's a remote URL, we'll store the URL directly
        downloadUrl = imageUrl;
      }
      
      console.log('Preparing image metadata for Firestore');
      // Store image metadata in Firestore - make sure to properly handle potentially undefined fields
      const savedImage: SavedImage = {
        imageUrl: downloadUrl,
        prompt,
        createdAt: serverTimestamp(),
        userId: user.uid
      };
      
      // Only add modelUrl if it exists and is not empty
      if (modelUrl) {
        savedImage.modelUrl = modelUrl;
      }
      
      console.log('Saving image metadata to Firestore with fields:', Object.keys(savedImage));
      await addDoc(collection(db, 'images'), savedImage);
      console.log('Image metadata saved to Firestore successfully');
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Clear success message after 3 seconds
    } catch (error) {
      console.error('Error saving image:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
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
      // Create a synthetic form event that can be safely passed to handleSubmit
      const syntheticEvent = {
        preventDefault: () => {},
      } as React.FormEvent;
      
      handleSubmit(syntheticEvent);
    }
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
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Image Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-slate-400">Model</p>
                    <p className="font-medium text-slate-300">{imageDetails?.model || 'Stable Diffusion'}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Size</p>
                    <p className="font-medium text-slate-300">{imageDetails?.width || 768} × {imageDetails?.height || 768} px</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Inference Steps</p>
                    <p className="font-medium text-slate-300">{imageDetails?.inferenceSteps || 30}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Guidance Scale</p>
                    <p className="font-medium text-slate-300">{imageDetails?.guidanceScale || 7}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-slate-400">Generation Time</p>
                    <p className="font-medium text-slate-300">
                      {imageDetails?.generationTime ? 
                        `${imageDetails.generationTime.toFixed(2)} seconds` : 
                        'Unknown'}
                    </p>
                  </div>
                  
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-slate-400">Prompt</p>
                    <p className="font-medium text-slate-300">{prompt}</p>
                  </div>
                </div>
                
                {/* Save button */}
                <div className="border-t border-slate-700 pt-4 mt-4">
                  <button
                    onClick={saveImageToFirebase}
                    disabled={saving || !imageUrl}
                    className="flex items-center justify-center gap-2 bg-purple-900/60 border border-purple-700/60 text-white py-2 px-4 rounded-lg hover:bg-purple-800/60 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                        </svg>
                        Save to My Images
                      </>
                    )}
                  </button>
                  
                  {saveSuccess && (
                    <div className="mt-2 p-2 bg-green-900/30 border border-green-800 rounded-lg">
                      <p className="text-sm text-green-400 flex items-center">
                        <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Image saved successfully to your collection
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
              </div>
            </div>
            
            <div className="lg:col-span-2">
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
                  
                  <p className="text-sm text-slate-400">
                    Transform your image into a detailed 3D model with Tencent&apos;s advanced Hunyuan3D-2 technology.
                  </p>
                  
                  <button
                    onClick={generate3DModel}
                    disabled={generating3D || !prompt.trim()}
                    className="w-full btn-gradient text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {generating3D ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating 3D Model...
                      </span>
                    ) : 'Generate 3D Model'}
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
                    
                    <a 
                      href={modelUrl} 
                      download="generated-3d-model.glb"
                      className="block w-full btn-gradient text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg text-center transition-all"
                    >
                      <span className="flex items-center justify-center">
                        <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download 3D Model
                      </span>
                    </a>
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
    </div>
  );
} 