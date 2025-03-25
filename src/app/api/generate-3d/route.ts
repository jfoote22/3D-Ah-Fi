import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Model configuration
const MODEL_ID = "ndreca/hunyuan3d-2:4ac0c7d1ef7e7dd58bf92364262597272dea79bfdb158b26027f54eb667f28b8";
const MODEL_NAME = "Hunyuan3D-2";

// Track request start times for debugging
const requestStartTimes = new Map<string, number>();

// Logger function for consistent logging
const logProgress = (requestId: string, message: string, data?: any) => {
  const elapsedTime = requestStartTimes.has(requestId) 
    ? ((Date.now() - requestStartTimes.get(requestId)!) / 1000).toFixed(2)
    : '0.00';
  console.log(`[${MODEL_NAME}-${requestId}] [${elapsedTime}s] ${message}`, data || '');
};

// Function to validate image URL
async function isImageUrlValid(url: string): Promise<boolean> {
  try {
    // Log if this is a Firebase Storage URL
    const isFirebaseStorage = url.includes('firebasestorage.googleapis.com');
    if (isFirebaseStorage) {
      console.log(`Validating Firebase Storage image URL: ${url.substring(0, 50)}...`);
      
      // For Firebase Storage URLs, we need a more robust check
      // Sometimes HEAD requests don't work well with Firebase Storage
      try {
        // Try a full GET request instead of HEAD for Firebase Storage
        const response = await fetch(url, { 
          method: 'GET',
          headers: {
            // Add a cache-control header to prevent caching issues
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          console.error(`Firebase Storage image validation failed with status: ${response.status}`);
          return false;
        }
        
        // Check if content type is an image
        const contentType = response.headers.get('content-type');
        const isImage = contentType ? contentType.startsWith('image/') : false;
        
        if (isImage) {
          console.log(`Successfully validated Firebase Storage image with content type: ${contentType}`);
          return true;
        } else {
          console.error(`Firebase Storage URL content type is not an image: ${contentType}`);
          return false;
        }
      } catch (firebaseError) {
        console.error(`Error validating Firebase Storage image: ${firebaseError instanceof Error ? firebaseError.message : String(firebaseError)}`);
        return false;
      }
    }
    
    // Standard validation for non-Firebase URLs
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) {
      console.error(`Image URL validation failed with status: ${response.status}`);
      return false;
    }
    
    // Check if content type is an image
    const contentType = response.headers.get('content-type');
    const isImage = contentType ? contentType.startsWith('image/') : false;
    return isImage;
  } catch (error) {
    console.error(`Error validating image URL: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Function to prepare image URL for Replicate
async function prepareImageUrlForReplicate(url: string): Promise<string> {
  // If it's a Firebase Storage URL, we may need to handle it specially
  if (url.includes('firebasestorage.googleapis.com')) {
    // Log the URL being processed
    console.log(`Preparing Firebase Storage URL for Replicate: ${url.substring(0, 50)}...`);
    
    try {
      // For Firebase Storage URLs, we'll try to fetch the image data and check it's valid
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          // Add a referer header to help with CORS
          'Referer': 'https://app-3dah-fi.vercel.app/',
          // Add more realistic headers like a browser would
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      
      if (!response.ok) {
        console.error(`Firebase Storage fetch failed with status: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to access Firebase Storage image: HTTP ${response.status}`);
      }
      
      // Get content type
      const contentType = response.headers.get('content-type');
      console.log(`Firebase Storage image content type: ${contentType}`);
      
      // Verify it's an image by checking content type
      if (!contentType || !contentType.startsWith('image/')) {
        console.error(`Not an image content type: ${contentType}`);
        throw new Error(`Firebase Storage URL is not an image: ${contentType || 'unknown content type'}`);
      }
      
      console.log(`Firebase Storage image URL is valid and accessible`);
      
      // Return the original URL - it should be accessible to Replicate
      return url;
    } catch (error) {
      console.error(`Error preparing Firebase Storage URL: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to prepare image from Firebase Storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // For non-Firebase URLs, just return as is
  return url;
}

export async function POST(request: Request) {
  const requestId = uuidv4();
  requestStartTimes.set(requestId, Date.now());
  
  try {
    logProgress(requestId, 'Starting 3D model generation request');
    
    const body = await request.json();
    const { prompt, imageUrl } = body;
    
    logProgress(requestId, 'Request body:', { 
      prompt: prompt ? prompt.substring(0, 50) + '...' : 'none',
      imageUrl: imageUrl ? imageUrl.substring(0, 50) + '...' : 'none'
    });

    if (!imageUrl) {
      logProgress(requestId, 'Error: No image URL provided');
      return NextResponse.json(
        { error: 'Please provide an image URL' },
        { status: 400 }
      );
    }

    // Validate image URL
    try {
      const url = new URL(imageUrl);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      logProgress(requestId, 'Error: Invalid image URL', error);
      return NextResponse.json(
        { error: 'Invalid image URL provided' },
        { status: 400 }
      );
    }

    // Initialize Replicate client
    if (!process.env.REPLICATE_API_TOKEN) {
      logProgress(requestId, 'Error: Missing Replicate API token');
      return NextResponse.json(
        { error: 'Server configuration error: Missing Replicate API token' },
        { status: 500 }
      );
    }

    logProgress(requestId, 'Starting model prediction');
    const startTime = Date.now();

    // Prepare image URL for Replicate
    let processedImageUrl = imageUrl;
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
      // For Firebase Storage URLs, we need to ensure they're publicly accessible
      processedImageUrl = imageUrl.split('?')[0];
    }

    logProgress(requestId, 'Sending request to Replicate with parameters:', {
      modelId: MODEL_ID,
      imageUrl: processedImageUrl.substring(0, 50) + '...',
      prompt: prompt || "A detailed 3D model"
    });

    // Start the model prediction
    const output = await replicate.run(
      MODEL_ID,
      {
        input: {
          image: processedImageUrl,
          prompt: prompt || "A detailed 3D model",
          negative_prompt: "blurry, low quality, distorted, deformed",
          num_inference_steps: 50,
          guidance_scale: 7.5,
          width: 512,
          height: 512,
          num_frames: 16,
          fps: 8,
          motion_bucket_id: 127,
          cond_aug: 0.02,
          decoding_t: 7,
          seed: -1
        }
      }
    );

    const generationTime = (Date.now() - startTime) / 1000;
    logProgress(requestId, `Model prediction completed in ${generationTime.toFixed(2)}s`);

    if (!output || typeof output !== 'object') {
      logProgress(requestId, 'Error: Invalid output from model', output);
      return NextResponse.json(
        { error: 'Invalid response from model generation service' },
        { status: 500 }
      );
    }

    // Process the output
    const modelUrl = Array.isArray(output) ? output[0] : output;
    
    if (!modelUrl || typeof modelUrl !== 'string') {
      logProgress(requestId, 'Error: No model URL in output', output);
      return NextResponse.json(
        { error: 'No model URL returned from generation service' },
        { status: 500 }
      );
    }

    logProgress(requestId, 'Successfully generated 3D model', {
      modelUrl: modelUrl.substring(0, 50) + '...',
      generationTime: generationTime.toFixed(2) + 's'
    });

    // Clean up
    requestStartTimes.delete(requestId);

    return NextResponse.json({
      modelUrl,
      generationTime: generationTime.toFixed(2)
    });

  } catch (error) {
    logProgress(requestId, 'Error during model generation:', error);
    
    // Clean up
    requestStartTimes.delete(requestId);

    // Handle specific error types
    if (error instanceof Error) {
      // Log detailed error information
      console.error(`[${MODEL_NAME}-${requestId}] Detailed error:`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Model generation timed out. Please try again with a simpler prompt or image.' },
          { status: 504 }
        );
      }
      
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: 'Authentication failed with Replicate API. Please check your API token.' },
          { status: 401 }
        );
      }

      if (error.message.includes('402') || error.message.includes('payment required')) {
        return NextResponse.json(
          { error: 'Payment required for this model. Please check your Replicate account.' },
          { status: 402 }
        );
      }
      
      return NextResponse.json(
        { error: `Model generation failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred during model generation' },
      { status: 500 }
    );
  }
} 