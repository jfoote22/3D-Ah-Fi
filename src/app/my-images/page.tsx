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

export default function MyImages() {
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
    // Load images from localStorage on component mount
    loadImagesFromStorage();
  }, []);

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
      console.log('[DEBUG-3D] Starting 3D model generation from My Images with prompt:', image.prompt);
      
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
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text">My Images</h1>
            <p className="text-slate-400 mt-2">Your saved AI-generated images and 3D models</p>
          </div>
          
          <Link 
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Generate New Image
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg">
            <p className="text-red-400">{error}</p>
            <button 
              onClick={loadImagesFromStorage}
              className="mt-2 text-red-300 hover:text-red-200 underline"
            >
              Try Again
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <span className="ml-2 text-slate-400">Loading your images...</span>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-medium text-slate-300 mb-2">No images saved yet</h3>
              <p>Generate and save some images to see them here!</p>
            </div>
            <Link 
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Generate Your First Image
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {images.map((image) => (
              <div key={image.id} className="bg-slate-800/50 backdrop-blur-xl rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors">
                <div className="aspect-square relative mb-4 rounded-lg overflow-hidden bg-slate-700">
                  <Image
                    src={image.imageUrl}
                    alt={image.prompt}
                    fill
                    className="object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                    onClick={() => setSelectedImage(image)}
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-slate-300 line-clamp-2">{image.prompt}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(image.createdAt).toLocaleDateString()}
                  </p>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center space-x-2">
                      {image.modelUrl && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-900/50 text-purple-300 border border-purple-800/50">
                          <Box className="w-3 h-3 mr-1" />
                          3D Model
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={() => handleDeleteImage(image)}
                      disabled={isDeleting}
                      className="p-1 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Image Detail Modal */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                    </div>

                    {model3DError && (
                      <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg">
                        <p className="text-red-400 text-sm">{model3DError}</p>
                      </div>
                    )}

                    {model3DSuccess && (
                      <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg">
                        <p className="text-green-400 text-sm">{model3DSuccess}</p>
                        {modelGenerationTime && (
                          <p className="text-green-300 text-xs mt-1">
                            Generated in {modelGenerationTime.toFixed(1)}s
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-white mb-2">Prompt</h3>
                      <p className="text-slate-300 bg-slate-900/50 p-3 rounded-lg">{selectedImage.prompt}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-white mb-2">Created</h3>
                      <p className="text-slate-400">{new Date(selectedImage.createdAt).toLocaleString()}</p>
                    </div>
                    
                    {selectedImage.modelUrl && (
                      <div>
                        <h3 className="text-lg font-medium text-white mb-2">3D Model</h3>
                        <div className="bg-slate-900/50 p-3 rounded-lg">
                                                     <ModelViewer src={selectedImage.modelUrl} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {deleteError && (
          <div className="fixed bottom-4 right-4 bg-red-900/90 border border-red-800 text-red-200 px-4 py-2 rounded-lg">
            {deleteError}
          </div>
        )}
      </div>
    </div>
  );
} 