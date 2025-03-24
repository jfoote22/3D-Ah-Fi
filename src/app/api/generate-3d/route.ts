import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Keep track of request count for debugging
let requestCount = 0;

// Use the Hunyuan3D-2 model with exact ID
const MODEL_ID = "ndreca/hunyuan3d-2:4ac0c7d1ef7e7dd58bf92364262597272dea79bfdb158b26027f54eb667f28b8";
const MODEL_NAME = "Hunyuan3D-2";

// Create a map to store request start times
const startTimes = new Map<string, number>();

// Logger function for tracking progress with timestamps
function logProgress(requestId: string, message: string) {
  const elapsedTime = (Date.now() - (startTimes.get(requestId) || Date.now())) / 1000;
  console.log(`[${new Date().toISOString()}][Request ${requestId}][${elapsedTime.toFixed(2)}s] ${message}`);
}

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

export async function POST(req: Request) {
  // Generate a unique ID for this request to track it in logs
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  startTimes.set(requestId, Date.now());
  
  logProgress(requestId, `Starting 3D model generation request`);
  
  try {
    // Parse request body
    const body = await req.json();
    const { prompt, imageUrl } = body;
    
    logProgress(requestId, `Received request with prompt: "${prompt?.substring(0, 30)}..." and image URL`);
    
    // Identify source based on image URL
    const isFromFirebaseStorage = imageUrl && imageUrl.includes('firebasestorage.googleapis.com');
    
    logProgress(requestId, `Request source: ${isFromFirebaseStorage ? 'Firebase Storage (stored image)' : 'Direct URL (new image)'}`);
    
    // Validate input
    if (!imageUrl) {
      logProgress(requestId, `Error: Missing image URL parameter`);
      return NextResponse.json({ error: 'Missing image URL parameter' }, { status: 400 });
    }
    
    // For Firebase Storage URLs, we'll skip the basic validation here and do thorough validation in prepareImageUrlForReplicate
    if (!isFromFirebaseStorage) {
      // Validate image URL only for non-Firebase URLs
      logProgress(requestId, `Validating image URL: ${imageUrl.substring(0, 50)}...`);
      const isValid = await isImageUrlValid(imageUrl);
      if (!isValid) {
        logProgress(requestId, `Error: Invalid or inaccessible image URL`);
        return NextResponse.json({ 
          error: 'The image URL provided is invalid or inaccessible. Please make sure the URL is directly accessible and is a valid image file.' 
        }, { status: 400 });
      }
    } else {
      logProgress(requestId, `Skipping basic validation for Firebase Storage URL. Will handle in preparation step.`);
    }
    
    // Set up Replicate client with API token
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      logProgress(requestId, `Error: Missing Replicate API token`);
      return NextResponse.json({ error: 'Replicate API token not configured' }, { status: 500 });
    }
    
    logProgress(requestId, `Initializing Replicate client...`);
    
    try {
      // Create Replicate client
      const replicate = new Replicate({
        auth: token,
      });
      
      logProgress(requestId, `Starting model prediction with ${MODEL_NAME}`);
      
      // Using simpler format, just passing the image URL in the input object
      const input = {
        image: imageUrl
      };
      
      logProgress(requestId, `Processing image URL before sending to Replicate`);
      
      // Prepare the image URL for Replicate
      try {
        const preparedUrl = await prepareImageUrlForReplicate(imageUrl);
        
        // Update input with prepared URL
        input.image = preparedUrl;
        logProgress(requestId, `Image URL processed successfully`);
      } catch (prepError) {
        logProgress(requestId, `Error preparing image URL: ${prepError instanceof Error ? prepError.message : String(prepError)}`);
        return NextResponse.json({ 
          error: `Failed to prepare image for processing: ${prepError instanceof Error ? prepError.message : String(prepError)}` 
        }, { status: 400 });
      }
      
      logProgress(requestId, `Sending request to Replicate with prepared input`);
      
      const output = await replicate.run(MODEL_ID, { input });
      
      // Log the raw output for debugging
      logProgress(requestId, `Generation completed! Raw output: ${JSON.stringify(output)}`);
      
      // Process the output - Hunyuan3D-2 returns an object with a mesh property
      if (!output) {
        throw new Error("Model returned empty output");
      }
      
      // Extract the model URL
      let modelUrl: string | undefined;
      
      if (typeof output === 'object' && output !== null) {
        const outputObj = output as Record<string, unknown>;
        
        // Check for mesh property first (expected from Hunyuan3D-2)
        if (outputObj.mesh && typeof outputObj.mesh === 'string') {
          modelUrl = outputObj.mesh;
        } 
        // Fallbacks if mesh property isn't present
        else if (outputObj.glb && typeof outputObj.glb === 'string') {
          modelUrl = outputObj.glb;
        } 
        else if (outputObj.output && typeof outputObj.output === 'string') {
          modelUrl = outputObj.output;
        }
      }
      // If output is a string URL directly
      else if (typeof output === 'string') {
        modelUrl = output;
      }
      // If output is an array with URLs
      else if (Array.isArray(output)) {
        const outputArray = output as unknown[];
        if (outputArray.length > 0 && typeof outputArray[0] === 'string') {
          modelUrl = outputArray[0] as string;
        }
      }
      
      // Check if we found a valid URL
      if (!modelUrl) {
        throw new Error(`Model returned output but no valid URL was found: ${JSON.stringify(output)}`);
      }
      
      logProgress(requestId, `Extracted model URL: ${modelUrl}`);
      
      // Clean up the start time
      startTimes.delete(requestId);
      
      // Return the modelUrl
      return NextResponse.json({ modelUrl });
      
    } catch (error: any) {
      logProgress(requestId, `Error using Replicate client: ${error.message}`);
      
      // Check if error response contains details
      if (error.response) {
        try {
          logProgress(requestId, `Error response: ${JSON.stringify(error.response)}`);
        } catch (e) {
          logProgress(requestId, `Could not stringify error response`);
        }
      }
      
      // Check for specific error messages
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('invalid version') || errorMsg.includes('not permitted')) {
        return NextResponse.json({ 
          error: 'The 3D model is not available. This could be due to API access restrictions or the model has been removed from Replicate.'
        }, { status: 422 });
      } else if (errorMsg.includes('not found')) {
        return NextResponse.json({ 
          error: 'The image or resource could not be processed. Please try a different image or prompt.'
        }, { status: 400 });
      } else if (errorMsg.includes('firebase') || errorMsg.includes('storage')) {
        return NextResponse.json({ 
          error: 'There was an issue accessing your stored image. This could be due to permissions or the image is no longer available. Try generating a new image.'
        }, { status: 400 });
      } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
        return NextResponse.json({ 
          error: 'The 3D generation process timed out. The Hunyuan3D-2 model requires 2-3 minutes for complex models. Try again with a simpler image.'
        }, { status: 408 });
      }
      
      return NextResponse.json({ 
        error: `Failed with Replicate client: ${error.message}` 
      }, { status: 500 });
    }
  } catch (error: any) {
    logProgress(requestId, `Unexpected error: ${error.message}`);
    
    // Clean up the start time
    startTimes.delete(requestId);
    
    return NextResponse.json({ error: `Internal server error: ${error.message}` }, { status: 500 });
  }
} 