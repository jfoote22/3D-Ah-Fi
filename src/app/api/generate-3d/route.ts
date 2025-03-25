import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';

// Initialize Replicate client
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Model configuration
const MODEL_ID = "tencent/hunyuan3d-2mv:71798fbc3c9f7b7097e3bb85496e5a797d8b8f616b550692e7c3e176a8e9e5db";
const MODEL_NAME = "Hunyuan3D-2MV";

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

    // Skip explicit token validation, we'll catch auth errors in the main API call
    logProgress(requestId, 'Using Replicate API token provided in environment variables');

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

    // Log the exact parameters being sent to Replicate for debugging
    const replicateParams: {
      front_image: string;
      left_image: string;
      back_image: string;
      seed: number;
      steps: number;
      file_type: string;
      num_chunks: number;
      guidance_scale: number;
      randomize_seed: boolean;
      target_face_num: number;
      octree_resolution: number;
      remove_background: boolean;
      prompt?: string;
    } = {
      front_image: processedImageUrl,
      // Since we only have one image, we'll use the same image for all views
      // In a real multi-view scenario, you'd want different angles of the same object
      left_image: processedImageUrl,
      back_image: processedImageUrl,
      seed: 1234,
      steps: 30,
      file_type: "glb",
      num_chunks: 200000,
      guidance_scale: 5,
      randomize_seed: true,
      target_face_num: 10000,
      octree_resolution: 256,
      remove_background: true
    };

    // Add prompt if provided
    if (prompt) {
      replicateParams.prompt = prompt;
    }
    
    logProgress(requestId, 'Full Replicate parameters:', replicateParams);

    // Start the model prediction
    try {
      const output = await replicate.run(
        MODEL_ID,
        {
          input: replicateParams
        }
      );

      logProgress(requestId, 'Received response from Replicate:', {
        outputType: typeof output,
        isArray: Array.isArray(output),
        outputLength: Array.isArray(output) ? output.length : 'N/A',
        outputPreview: typeof output === 'object' ? JSON.stringify(output).substring(0, 200) : String(output).substring(0, 200)
      });

      const generationTime = (Date.now() - startTime) / 1000;
      logProgress(requestId, `Model prediction completed in ${generationTime.toFixed(2)}s`);

      if (!output) {
        logProgress(requestId, 'Error: No output from Replicate');
        return NextResponse.json(
          { error: 'No output returned from model generation service' },
          { status: 500 }
        );
      }

      // Process the output - handle different possible response formats
      let modelUrl: string | null = null;
      
      if (typeof output === 'string') {
        // Format 1: Direct string URL
        modelUrl = output;
        logProgress(requestId, 'Output is directly a string URL');
      } else if (Array.isArray(output) && output.length > 0) {
        // Format 2: Array with URL as first element
        modelUrl = output[0];
        logProgress(requestId, 'Extracted model URL from array output');
      } else if (typeof output === 'object' && output !== null) {
        // Format 3: Object with specific properties
        if ('glb' in output && typeof output.glb === 'string') {
          modelUrl = output.glb;
          logProgress(requestId, 'Extracted model URL from output.glb property');
        } else if ('model' in output && typeof output.model === 'string') {
          modelUrl = output.model;
          logProgress(requestId, 'Extracted model URL from output.model property');
        } else if ('url' in output && typeof output.url === 'string') {
          modelUrl = output.url;
          logProgress(requestId, 'Extracted model URL from output.url property');
        } else if ('output' in output) {
          // Format 4: Object with output property which might be an array or string
          const innerOutput = output.output;
          if (Array.isArray(innerOutput) && innerOutput.length > 0) {
            modelUrl = innerOutput[0];
            logProgress(requestId, 'Extracted model URL from object.output array');
          } else if (typeof innerOutput === 'string') {
            modelUrl = innerOutput;
            logProgress(requestId, 'Extracted model URL from object.output string');
          } else if (typeof innerOutput === 'object' && innerOutput !== null) {
            if ('glb' in innerOutput && typeof innerOutput.glb === 'string') {
              modelUrl = innerOutput.glb;
              logProgress(requestId, 'Extracted model URL from output.output.glb property');
            }
          }
        }
      }
      
      // Log the full output for debugging
      console.log(`[${MODEL_NAME}-${requestId}] Full Replicate output:`, JSON.stringify(output, null, 2));
      
      if (!modelUrl) {
        logProgress(requestId, 'Error: Could not extract model URL from output', output);
        return NextResponse.json(
          { error: 'No model URL found in the response from generation service', 
            details: JSON.stringify(output) },
          { status: 500 }
        );
      }

      // Validate the model URL format
      try {
        new URL(modelUrl);
      } catch (urlError) {
        logProgress(requestId, 'Error: Invalid model URL format', modelUrl);
        return NextResponse.json(
          { error: 'Invalid model URL format in response', 
            details: modelUrl },
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
    } catch (replicateError) {
      logProgress(requestId, 'Error during Replicate API call:', {
        error: replicateError instanceof Error ? {
          name: replicateError.name,
          message: replicateError.message,
          stack: replicateError.stack,
          cause: replicateError.cause
        } : replicateError
      });

      // Handle specific error types
      if (replicateError instanceof Error) {
        const errorMessage = replicateError.message.toLowerCase();
        
        if (errorMessage.includes('timeout')) {
          return NextResponse.json(
            { error: 'Model generation timed out. Please try again with a simpler prompt or image.' },
            { status: 504 }
          );
        }
        
        if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          return NextResponse.json(
            { error: 'Authentication failed with Replicate API. Please check your API token.' },
            { status: 401 }
          );
        }

        if (errorMessage.includes('402') || errorMessage.includes('payment required')) {
          return NextResponse.json(
            { error: 'Payment required for this model. Please check your Replicate account.' },
            { status: 402 }
          );
        }

        if (errorMessage.includes('422') || errorMessage.includes('invalid version')) {
          return NextResponse.json(
            { error: 'Invalid model version or not permitted to use this model.' },
            { status: 422 }
          );
        }

        if (errorMessage.includes('429') || errorMessage.includes('too many requests')) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
          );
        }
        
        return NextResponse.json(
          { error: `Model generation failed: ${replicateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: 'An unexpected error occurred during model generation' },
        { status: 500 }
      );
    }

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