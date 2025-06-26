'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import Header from '../components/Header';
import ModelViewer from '../components/ModelViewer';
import { Loader2, Box, Trash2 } from 'lucide-react';

interface SavedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelUrl?: string;
  createdAt: string;
  userId: string;
}

export default function MyModels() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<SavedImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [generating3D, setGenerating3D] = useState(false);
  const [model3DError, setModel3DError] = useState<string | null>(null);
  const [model3DSuccess, setModel3DSuccess] = useState<string | null>(null);
  const [modelGenerationTime, setModelGenerationTime] = useState<number | null>(null);
  const [debugMessage, setDebugMessage] = useState<string>('');

  useEffect(() => {
    // Debug information
    console.log('My Models page - Auth state:', { user, loading });
    setDebugMessage(`Auth state: ${loading ? 'Loading' : 'Ready'}, User: ${user ? 'Authenticated' : 'Not authenticated'}`);
    
    // If not loading and user is not authenticated, redirect to login page
    if (!loading && !user) {
      console.log('User not authenticated, redirecting to login page');
      router.push('/login');
    }
  }, [user, loading, router]);

  // Load images from localStorage
  const loadImagesFromStorage = () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const savedImages = JSON.parse(localStorage.getItem('saved-images') || '[]');
      console.log(`Loaded ${savedImages.length} images from localStorage`);
      
      setImages(savedImages);
    } catch (error) {
      console.error('Error loading images from localStorage:', error);
      setError('Failed to load saved images');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch images if user is authenticated
    if (user) {
      loadImagesFromStorage();
    }
  }, [user]);

  const handleDeleteImage = async (image: SavedImage) => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      console.log(`Deleting image: ${image.id}`);
      
      // Get current images from localStorage
      const savedImages = JSON.parse(localStorage.getItem('saved-images') || '[]');
      
      // Filter out the image to delete
      const updatedImages = savedImages.filter((img: SavedImage) => img.id !== image.id);
      
      // Save back to localStorage
      localStorage.setItem('saved-images', JSON.stringify(updatedImages));
      
      // Update state
      setImages(updatedImages);
      
      // Close modal if the deleted image was selected
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
      }
      
      console.log('Successfully deleted image from localStorage');
    } catch (error) {
      console.error('Error deleting image:', error);
      setDeleteError(`Failed to delete image: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Function to generate 3D model from a saved image
  const generate3DModel = async (image: SavedImage) => {
    if (!image.prompt || !image.imageUrl) {
      setModel3DError('Missing prompt or image URL required for 3D generation');
      return;
    }

    setGenerating3D(true);
    setModel3DError(null);
    setModel3DSuccess(null);

    try {
      console.log('[DEBUG-3D] Starting 3D model generation from My Models with prompt:', image.prompt);
      console.log('[DEBUG-3D] Using stored image URL:', image.imageUrl ? image.imageUrl.substring(0, 50) + '...' : 'none');
      console.log('[DEBUG-3D] Image ID:', image.id);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[DEBUG-3D] Client-side timeout triggered after 5 minutes');
        controller.abort();
      }, 300000); // 5 minute timeout
      
      const startTime = Date.now();
      
      const response = await fetch('/api/generate-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: image.prompt,
          imageUrl: image.imageUrl
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate 3D model');
      }

      const data = await response.json();
      const generationTime = (Date.now() - startTime) / 1000;

      if (data.modelUrl) {
        console.log('[DEBUG-3D] 3D model generated successfully');
        setModel3DSuccess('3D model generated successfully!');
        setModelGenerationTime(generationTime);
        
        // Update the image with the model URL in localStorage
        const savedImages = JSON.parse(localStorage.getItem('saved-images') || '[]');
        const updatedImages = savedImages.map((img: SavedImage) => 
          img.id === image.id ? { ...img, modelUrl: data.modelUrl } : img
        );
        localStorage.setItem('saved-images', JSON.stringify(updatedImages));
        
        // Update state
        setImages(updatedImages);
        
        // Update selected image if it's the current one
        if (selectedImage?.id === image.id) {
          setSelectedImage({ ...selectedImage, modelUrl: data.modelUrl });
        }
        
        setTimeout(() => setModel3DSuccess(null), 5000);
      } else {
        throw new Error('No model URL in response');
      }
    } catch (error: any) {
      console.error('[DEBUG-3D] Error generating 3D model:', error);
      if (error.name === 'AbortError') {
        setModel3DError('3D model generation timed out. Please try again.');
      } else {
        setModel3DError(error.message || 'Failed to generate 3D model');
      }
    } finally {
      setGenerating3D(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-white text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      {process.env.NODE_ENV !== 'production' && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900/80 p-2 rounded border border-slate-700 text-xs font-mono text-slate-400 max-w-xs">
          {debugMessage}
        </div>
      )}
      <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4">
          {/* Page header */}
          <div className="mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold gradient-text">My Models</h1>
                <p className="text-slate-400 mt-2">View and manage your saved AI-generated images and 3D models</p>
              </div>
              <Link 
                href="/"
                className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-700 transition-all w-full sm:w-auto"
              >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Generator
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
              <p className="text-red-400 flex items-center">
                <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
              <button 
                onClick={loadImagesFromStorage}
                className="mt-2 text-red-300 hover:text-red-200 underline"
              >
                Try Again
              </button>
            </div>
          )}
          
          {/* Content */}
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto"></div>
                <p className="text-blue-400 font-medium">Loading your models...</p>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-10 text-center shadow-xl">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-300 mb-2">No models saved yet</h2>
              <p className="text-slate-400 mb-6">Generate and save some images and 3D models to see them here</p>
              <Link 
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-purple-600 text-white py-2 px-6 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all shadow-md"
              >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Models
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {images.map((image) => (
                <div 
                  key={image.id} 
                  className="bg-slate-800/90 backdrop-blur-xl rounded-lg border border-slate-700 overflow-hidden shadow-md hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => setSelectedImage(image)}
                >
                  <div className="aspect-square relative overflow-hidden bg-slate-900">
                    <Image
                      src={image.imageUrl}
                      alt={image.prompt}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <p className="text-slate-300 font-medium line-clamp-2 h-12">{image.prompt}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-slate-500 text-sm">
                        {new Date(image.createdAt).toLocaleDateString()}
                      </p>
                      {image.modelUrl && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50">
                          <Box className="w-3 h-3 mr-1" />
                          3D
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Image detail modal */}
          {selectedImage && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
              <div 
                className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-white">Image Details</h2>
                    <button
                      onClick={() => setSelectedImage(null)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="aspect-square relative rounded-lg overflow-hidden bg-slate-700">
                        <Image
                          src={selectedImage.imageUrl}
                          alt={selectedImage.prompt}
                          fill
                          className="object-cover"
                        />
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => generate3DModel(selectedImage)}
                          disabled={generating3D}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
                        >
                          {generating3D ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Generating 3D...
                            </>
                          ) : (
                            <>
                              <Box className="w-4 h-4 mr-2" />
                              Generate 3D Model
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => handleDeleteImage(selectedImage)}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-200 mb-2">Prompt</h3>
                        <p className="text-slate-300">{selectedImage.prompt}</p>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold text-slate-200 mb-2">Created</h3>
                        <p className="text-slate-300">{new Date(selectedImage.createdAt).toLocaleString()}</p>
                      </div>
                      
                      {selectedImage.modelUrl && (
                        <div>
                          <h3 className="text-lg font-semibold text-slate-200 mb-2">3D Model</h3>
                          <div className="bg-slate-900 rounded-lg p-4">
                            <ModelViewer
                              src={selectedImage.modelUrl}
                              alt={`3D model generated from: ${selectedImage.prompt}`}
                              poster={selectedImage.imageUrl}
                              className="w-full h-64 rounded-lg"
                            />
                          </div>
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
                      
                      {deleteError && (
                        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3">
                          <p className="text-sm text-red-400">{deleteError}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 