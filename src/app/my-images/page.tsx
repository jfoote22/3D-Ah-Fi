'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { db, storage } from '@/lib/firebase/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import Header from '../components/Header';
import ModelViewer from '../components/ModelViewer';
import { Loader2, Box } from 'lucide-react';

interface SavedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  modelUrl?: string;
  createdAt: any;
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
  const [debugMessage, setDebugMessage] = useState<string>('');
  const [generating3D, setGenerating3D] = useState(false);
  const [model3DError, setModel3DError] = useState<string | null>(null);
  const [model3DSuccess, setModel3DSuccess] = useState<string | null>(null);
  const [modelGenerationTime, setModelGenerationTime] = useState<number | null>(null);

  useEffect(() => {
    // Debug information
    console.log('My Images page - Auth state:', { user, loading });
    setDebugMessage(`Auth state: ${loading ? 'Loading' : 'Ready'}, User: ${user ? 'Authenticated' : 'Not authenticated'}`);
    
    // If not loading and user is not authenticated, redirect to login page
    if (!loading && !user) {
      console.log('User not authenticated, redirecting to login page');
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Only fetch images if user is authenticated
    if (user) {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Setting up Firestore listener for user images');
        // Create a query against the images collection for the current user
        // We're temporarily removing the orderBy to avoid needing a composite index
        const imagesQuery = query(
          collection(db, 'images'),
          where('userId', '==', user.uid)
          // orderBy('createdAt', 'desc') - removing this to avoid index requirement
        );
        
        // Set up a real-time listener
        const unsubscribe = onSnapshot(
          imagesQuery,
          (snapshot) => {
            const imageList: SavedImage[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              imageList.push({
                id: doc.id,
                imageUrl: data.imageUrl,
                prompt: data.prompt,
                modelUrl: data.modelUrl,
                createdAt: data.createdAt?.toDate() || new Date(),
                userId: data.userId
              });
            });
            
            // Sort the images by createdAt locally instead of in the query
            imageList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            
            console.log(`Fetched ${imageList.length} images for user`);
            setImages(imageList);
            setIsLoading(false);
          },
          (err) => {
            console.error('Error fetching images:', err);
            setError(`Failed to load your images: ${err instanceof Error ? err.message : String(err)}`);
            setIsLoading(false);
          }
        );
        
        // Clean up the listener when component unmounts
        return () => {
          console.log('Cleaning up Firestore listener');
          unsubscribe();
        };
      } catch (error) {
        console.error('Error setting up Firestore listener:', error);
        setError(`Failed to set up image listener: ${error instanceof Error ? error.message : String(error)}`);
        setIsLoading(false);
      }
    }
  }, [user]);

  const handleDeleteImage = async (image: SavedImage) => {
    if (!user || isDeleting) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      console.log(`Deleting image: ${image.id}`);
      // If image is stored in Firebase Storage (URL contains Firebase Storage domain)
      if (image.imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
          console.log('Image is in Firebase Storage, attempting to delete from Storage');
          // Extract the path from the URL (this is a simplification, actual parsing may vary)
          const urlParts = image.imageUrl.split('?')[0].split('/o/');
          if (urlParts.length > 1) {
            const path = decodeURIComponent(urlParts[1]);
            const imageRef = storageRef(storage, path);
            await deleteObject(imageRef);
            console.log('Successfully deleted image from Storage');
          }
        } catch (storageError) {
          console.error('Error deleting image from Storage:', storageError);
          // Continue with Firestore deletion even if Storage deletion fails
        }
      }
      
      // Delete document from Firestore
      await deleteDoc(doc(db, 'images', image.id));
      console.log('Successfully deleted image document from Firestore');
      
      // Close modal if the deleted image was selected
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
      }
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
      console.log('[DEBUG-3D] Using stored image URL from Firebase:', image.imageUrl ? image.imageUrl.substring(0, 50) + '...' : 'none');
      console.log('[DEBUG-3D] Image ID:', image.id);
      
      // Add timeout to fetch request - client-side timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('[DEBUG-3D] Client-side timeout triggered after 5 minutes');
        controller.abort();
      }, 300000); // 5 minute timeout
      
      const startTime = Date.now();
      
      // Status tracking for debugging
      const statusInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        console.log(`[DEBUG-3D] Still waiting for 3D model after ${elapsedTime.toFixed(0)} seconds...`);
      }, 5000); // Log every 5 seconds

      try {
        console.log('[DEBUG-3D] Preparing request to /api/generate-3d endpoint');
        console.log('[DEBUG-3D] Request body:', JSON.stringify({ 
          prompt: image.prompt,
          imageUrl: image.imageUrl ? image.imageUrl.substring(0, 50) + '...' : null
        }));
        
        console.log('[DEBUG-3D] Sending request to generate-3d API...');
        const requestStartTime = Date.now();
        
        const response = await fetch('/api/generate-3d', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt: image.prompt,
            imageUrl: image.imageUrl
          }),
          signal: controller.signal
        }).catch(fetchError => {
          console.error('[DEBUG-3D] Fetch error caught:', fetchError);
          // Handle abort/timeout specifically
          if (fetchError.name === 'AbortError') {
            clearInterval(statusInterval);
            throw new Error('Request timed out. 3D model generation takes time, please try again with a simpler prompt or image.');
          }
          throw fetchError;
        });
        
        console.log(`[DEBUG-3D] Received response after ${((Date.now() - requestStartTime)/1000).toFixed(2)}s`);
        
        // Clear tracking
        clearTimeout(timeoutId);
        clearInterval(statusInterval);
        
        console.log('[DEBUG-3D] Response status:', response.status, response.statusText);
        console.log('[DEBUG-3D] Response headers:', {
          'content-type': response.headers.get('content-type'),
          'content-length': response.headers.get('content-length')
        });

        // For debugging - log non-2xx responses
        if (!response.ok) {
          console.error(`[DEBUG-3D] Server error status: ${response.status}`);
          try {
            // Try to extract detailed error information
            const errorText = await response.text();
            console.error('[DEBUG-3D] Error response body:', errorText);
            
            let errorData;
            try {
              errorData = JSON.parse(errorText);
              console.error('[DEBUG-3D] Parsed error data:', errorData);
            } catch (jsonError) {
              console.error('[DEBUG-3D] Could not parse error response as JSON:', jsonError);
              errorData = { error: errorText };
            }
            
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
            console.error('[DEBUG-3D] Error handling response:', parseError);
            if (parseError instanceof Error && parseError.message.includes('currentStep')) {
              throw parseError; // Re-throw the parsed error with step info
            }
            // If we can't parse the response, just use the status text
            const errorText = await response.text().catch((err) => {
              console.error('[DEBUG-3D] Failed to read response text:', err);
              return response.statusText;
            });
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
          }
        }

        console.log('[DEBUG-3D] Parsing response JSON...');
        const data = await response.json();
        console.log('[DEBUG-3D] 3D generation response:', data);

        if ('error' in data) {
          throw new Error(data.error as string);
        }

        if (!data.modelUrl) {
          throw new Error('No model URL returned from the server');
        }
        
        // Calculate generation time in seconds
        const generationTime = (Date.now() - startTime) / 1000;
        setModelGenerationTime(generationTime);

        // Update the image record in Firestore with the model URL
        try {
          await updateDoc(doc(db, 'images', image.id), {
            modelUrl: data.modelUrl
          });
          console.log('[DEBUG-3D] Updated image record with 3D model URL:', data.modelUrl.substring(0, 50) + '...');
          
          // Update the selected image in state
          if (selectedImage && selectedImage.id === image.id) {
            setSelectedImage({
              ...selectedImage,
              modelUrl: data.modelUrl
            });
          }
          
          setModel3DSuccess('3D model generated successfully!');
          
          // Clear success message after 5 seconds
          setTimeout(() => {
            setModel3DSuccess(null);
          }, 5000);
        } catch (updateError) {
          console.error('[DEBUG-3D] Error updating image record:', updateError);
          throw new Error('Model generated but failed to save to your collection');
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        clearInterval(statusInterval);
        throw fetchError;
      }
    } catch (error) {
      console.error('[DEBUG-3D] Error generating 3D model:', error);
      
      // Handle different types of errors with user-friendly messages
      if (error instanceof Error) {
        if (error.message.includes('timed out') || error.message.includes('timeout')) {
          setModel3DError(
            'The 3D model generation timed out. The Hunyuan3D-2 model requires 2-3 minutes to generate complex models. ' +
            'Please try again with a simpler prompt or image.'
          );
        } else if (error.message.includes('invalid or inaccessible image')) {
          setModel3DError(
            'The stored image URL could not be accessed. The image might have been deleted from storage or is temporarily unavailable. ' +
            'Please try again later or generate a new image.'
          );
        } else if (error.message.includes('firebasestorage') && error.message.includes('403')) {
          setModel3DError(
            'Access to the stored image was denied. This may happen if the image was stored with restricted permissions. ' +
            'Please try generating a new image.'
          );
        } else if (error.message.includes('accessing your stored image')) {
          setModel3DError(
            'There was a problem accessing your stored image from Firebase Storage. ' +
            'This is likely due to the image no longer being available or accessible. ' +
            'Please try generating a new image.'
          );
        } else if (error.message.includes('prepare image') || error.message.includes('prepare')) {
          setModel3DError(
            'The system had trouble preparing your image for 3D generation. ' +
            'This might be due to an issue with the image format or storage. ' +
            'Please try generating a new image.'
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

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto"></div>
          <p className="text-blue-400 font-medium">Loading...</p>
          <p className="text-slate-500 text-sm mt-2">Checking authentication status</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, don't render the page content
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="text-red-400 font-medium mb-4">Not authenticated</div>
          <Link href="/login" className="btn-gradient text-white font-medium py-2 px-4 rounded-lg">
            Go to Login
          </Link>
          {process.env.NODE_ENV !== 'production' && (
            <p className="text-slate-500 text-xs mt-4 max-w-md font-mono">{debugMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
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
              <h1 className="text-3xl font-bold gradient-text">My Images</h1>
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
            <p className="text-slate-400 mt-2">View and manage your saved AI-generated images</p>
          </div>
          
          {/* Content */}
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-900/50 border-t-blue-500 rounded-full animate-spin mb-4 mx-auto"></div>
                <p className="text-blue-400 font-medium">Loading your images...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4">
              <p className="text-red-400 flex items-center">
                <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          ) : images.length === 0 ? (
            <div className="bg-slate-800/90 backdrop-blur-xl rounded-xl border border-slate-700 p-10 text-center shadow-xl">
              <div className="flex justify-center mb-4">
                <svg className="w-16 h-16 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-300 mb-2">No images saved yet</h2>
              <p className="text-slate-400 mb-6">Generate and save some images to see them here</p>
              <Link 
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-blue-600 to-purple-600 text-white py-2 px-6 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all shadow-md"
              >
                <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create Images
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
                    <p className="text-slate-500 text-sm mt-2">
                      {new Date(image.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Image detail modal */}
          {selectedImage && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
              <div 
                className="bg-slate-800 rounded-lg border border-slate-700 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-200">Image Details</h3>
                  <button 
                    className="text-slate-400 hover:text-white"
                    onClick={() => setSelectedImage(null)}
                  >
                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div className="mb-6 relative">
                        <div className="relative aspect-square bg-slate-900">
                          <Image
                            src={selectedImage.imageUrl}
                            alt={selectedImage.prompt}
                            fill
                            className="object-contain"
                            sizes="(max-width: 1024px) 100vw, 500px"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm text-slate-400 mb-1">Prompt</h4>
                          <p className="text-slate-200">{selectedImage.prompt}</p>
                        </div>
                        
                        <div>
                          <h4 className="text-sm text-slate-400 mb-1">Created</h4>
                          <p className="text-slate-200">
                            {new Date(selectedImage.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col">
                      {/* 3D Model Generation Section */}
                      <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-lg shadow-sm overflow-hidden mb-4">
                        <div className="p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="text-lg font-bold text-slate-100">3D Model Creator</h3>
                            <div className="bg-slate-900 rounded-lg px-3 py-1 text-xs font-medium text-purple-400 flex items-center border border-slate-700">
                              <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                              </svg>
                              Hunyuan3D-2
                            </div>
                          </div>
                          
                          {!selectedImage.modelUrl ? (
                            <>
                              <p className="text-sm text-slate-400 mb-4">
                                Transform this image into a detailed 3D model with Tencent's advanced Hunyuan3D-2 technology.
                              </p>
                              
                              <button
                                onClick={() => generate3DModel(selectedImage)}
                                disabled={generating3D}
                                className={`${generating3D ? 'opacity-50 cursor-not-allowed' : ''} w-full btn-gradient text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all mb-3`}
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
                              
                              {model3DError && (
                                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-3">
                                  <p className="text-sm text-red-400 flex items-center">
                                    <svg className="w-4 h-4 mr-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {model3DError}
                                  </p>
                                </div>
                              )}
                              
                              {model3DSuccess && (
                                <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 mb-3">
                                  <p className="text-sm text-green-400 flex items-center">
                                    <svg className="w-4 h-4 mr-1 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    {model3DSuccess}
                                  </p>
                                </div>
                              )}
                              
                              {generating3D && (
                                <div className="flex justify-center items-center py-4">
                                  <div className="text-center">
                                    <div className="relative">
                                      <div className="w-16 h-16 mb-4 mx-auto rounded bg-gradient-to-tr from-blue-500 to-purple-600 animate-pulse blur-sm absolute inset-0"></div>
                                      <div className="w-16 h-16 mb-4 mx-auto rounded bg-slate-900 backdrop-blur flex items-center justify-center relative z-10">
                                        <svg className="w-8 h-8 text-blue-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                                        </svg>
                                      </div>
                                    </div>
                                    <p className="text-blue-400 font-medium text-sm">Creating 3D model with Hunyuan3D-2...</p>
                                    <p className="text-slate-500 text-xs mt-1">This may take 2-3 minutes for complex models</p>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="space-y-4">
                              <ModelViewer
                                src={selectedImage.modelUrl}
                                alt={`3D model generated from image with prompt: ${selectedImage.prompt}`}
                                poster={selectedImage.imageUrl}
                                className="rounded-lg overflow-hidden border border-slate-700 shadow-sm h-[300px]"
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
                                href={selectedImage.modelUrl} 
                                download="generated-3d-model.glb"
                                className="block w-full btn-gradient text-white font-medium py-3 px-6 rounded-lg shadow-md hover:shadow-lg text-center transition-all"
                              >
                                <span className="flex items-center justify-center">
                                  <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 102 0v7.586l1.293-1.293a1 1 0 101.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                  Download 3D Model
                                </span>
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-slate-700 p-4 flex justify-between items-center">
                  <div>
                    {deleteError && (
                      <p className="text-red-400 text-sm">{deleteError}</p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <a 
                      href={selectedImage.imageUrl}
                      download={`image-${selectedImage.id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-slate-700 text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-600 transition-all"
                    >
                      <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 102 0v7.586l1.293-1.293a1 1 0 101.414 1.414l-3 3a1 1 0 00-1.414 0l-3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                      </svg>
                      Download Image
                    </a>
                    <button
                      onClick={() => handleDeleteImage(selectedImage)}
                      disabled={isDeleting}
                      className="flex items-center justify-center gap-2 bg-red-900/60 text-red-300 py-2 px-4 rounded-lg hover:bg-red-800/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeleting ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
} 