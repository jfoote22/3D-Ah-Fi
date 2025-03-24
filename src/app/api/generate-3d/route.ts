import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Keep track of request count for debugging
let requestCount = 0;

// Use the actual Hunyuan3D-2 model from ndreca
const MODEL_ID = "ndreca/hunyuan3d-2:4ac0c7d1ef7e7dd58bf92364262597272dea79bfdb158b26027f54eb667f28b8";
const MODEL_NAME = "Hunyuan3D-2";

// Set timeout for the Replicate API call (in milliseconds)
// We set this to slightly less than the Vercel function timeout to ensure we can handle gracefully
const API_TIMEOUT_MS = 840000; // 840 seconds (14 minutes)

// Set a separate shorter timeout for initial connection to Replicate
const INITIAL_CONNECTION_TIMEOUT_MS = 30000; // 30 seconds

// Helper function to create a promise that rejects after a timeout
function createTimeoutPromise(ms: number, message = `Operation timed out after ${ms / 1000} seconds`) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
}

// Track start times for each request
const startTimes = new Map<number, number>();

// Add function to log progress with timestamps
function logProgress(requestId: number, message: string) {
  const timestamp = new Date().toISOString();
  const elapsedTime = (Date.now() - (startTimes.get(requestId) || Date.now())) / 1000;
  console.log(`[${timestamp}] [3D Request #${requestId}] [${elapsedTime.toFixed(2)}s] ${message}`);
}

export async function POST(req: Request) {
  requestCount++;
  const currentRequest = requestCount;
  const startTime = Date.now();
  startTimes.set(currentRequest, startTime);
  
  logProgress(currentRequest, "Starting 3D model generation request");
  
  // Set up structured response to send step by step updates (if needed)
  let currentStep = "initialization";
  
  try {
    // First check if the API token is set before doing anything else
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      logProgress(currentRequest, "ERROR: Missing API token");
      return NextResponse.json(
        { error: "API configuration error: REPLICATE_API_TOKEN is not set" },
        { status: 500 }
      );
    }
    
    // Verify token format (basic validation)
    if (!apiToken.startsWith('r8_') && !apiToken.startsWith('test_')) {
      logProgress(currentRequest, `ERROR: API token has invalid format: ${apiToken.substring(0, 4)}...`);
      return NextResponse.json(
        { error: "API configuration error: REPLICATE_API_TOKEN format is invalid" },
        { status: 500 }
      );
    }
    
    logProgress(currentRequest, `API token found: ${apiToken.substring(0, 5)}...`);
    currentStep = "parsing_request";
    
    // Validate request body
    let reqBody;
    try {
      reqBody = await req.json();
      logProgress(currentRequest, "Request body parsed successfully");
    } catch (e) {
      logProgress(currentRequest, `Failed to parse request body: ${e instanceof Error ? e.message : String(e)}`);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { imageUrl, prompt } = reqBody;
    currentStep = "validating_input";
    
    // Validate input parameters
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      logProgress(currentRequest, "Missing or invalid prompt");
      return NextResponse.json(
        { error: 'Prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    // Log received parameters
    if (imageUrl) {
      logProgress(currentRequest, `Received image URL: "${imageUrl.substring(0, 30)}..."`);
    } else {
      logProgress(currentRequest, "No image URL provided, will generate 3D model from prompt only");
    }
    logProgress(currentRequest, `Received prompt: "${prompt}"`);
    
    currentStep = "initializing_replicate";
    
    // Create input parameters based on example
    const input: any = {
      prompt: prompt
    };
    
    // Only add image parameter if imageUrl is provided
    if (imageUrl) {
      input.image = imageUrl;
    }
    
    logProgress(currentRequest, "Creating Replicate client");
    const replicate = new Replicate({
      auth: apiToken,
    });

    logProgress(currentRequest, `Calling Replicate with model ID: ${MODEL_ID}`);
    logProgress(currentRequest, `Input parameters: ${JSON.stringify(input, null, 2)}`);
    
    currentStep = "connecting_to_replicate";
    
    // Test connection to Replicate with a short timeout first
    // This helps detect early issues with authentication and connectivity
    try {
      logProgress(currentRequest, "Testing connection to Replicate API");
      
      // Create a Replicate API call with a short timeout
      // We'll use a Promise.race between the connection test and a short timeout
      const connectionTest = await Promise.race([
        // Make a simple API call that should return quickly if the service is working
        (async () => {
          try {
            const modelInfo = await replicate.models.get(MODEL_ID.split(':')[0], MODEL_ID.split(':')[1]);
            return { success: true, model: modelInfo.name };
          } catch (e) {
            // If this is an auth error or model not found, we'll get a specific error
            // which is helpful for troubleshooting
            throw e;
          }
        })(),
        createTimeoutPromise(INITIAL_CONNECTION_TIMEOUT_MS, "Initial connection to Replicate API timed out")
      ]);
      
      logProgress(currentRequest, `Connection test successful: ${JSON.stringify(connectionTest)}`);
      
    } catch (connectionError) {
      logProgress(currentRequest, `Connection test failed: ${connectionError instanceof Error ? connectionError.message : String(connectionError)}`);
      
      // Check for specific connection errors and provide better error messages
      const errorMessage = connectionError instanceof Error ? connectionError.message : String(connectionError);
      
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        return NextResponse.json(
          { 
            error: 'Authentication failed. Please check your Replicate API token.',
            details: errorMessage,
            currentStep
          },
          { status: 401 }
        );
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        return NextResponse.json(
          { 
            error: 'Model not found. The Hunyuan3D-2 model may have been moved or renamed.',
            details: errorMessage,
            currentStep
          },
          { status: 404 }
        );
      } else if (errorMessage.includes('timed out')) {
        return NextResponse.json(
          { 
            error: 'Connection to Replicate API timed out. The service may be experiencing issues.',
            details: errorMessage,
            isTimeout: true,
            currentStep
          },
          { status: 504 }
        );
      }
      
      // Generic connection error
      return NextResponse.json(
        { 
          error: 'Failed to connect to Replicate API',
          details: errorMessage,
          currentStep
        },
        { status: 500 }
      );
    }
    
    currentStep = "calling_replicate";
    
    // Set up progress tracking for the API call
    let lastStatusUpdate = Date.now();
    const statusInterval = setInterval(() => {
      const now = Date.now();
      const elapsedSinceUpdate = (now - lastStatusUpdate) / 1000;
      const totalElapsed = (now - startTime) / 1000;
      logProgress(currentRequest, `Still waiting for Replicate response... (${elapsedSinceUpdate.toFixed(0)}s since last update, ${totalElapsed.toFixed(0)}s total)`);
    }, 10000); // Log every 10 seconds
    
    try {
      // Race between the API call and a timeout
      logProgress(currentRequest, `Starting Replicate API call with timeout of ${API_TIMEOUT_MS/1000}s`);
      
      const output = await Promise.race([
        replicate.run(
          MODEL_ID,
          { input }
        ),
        createTimeoutPromise(API_TIMEOUT_MS)
      ]);

      // Stop progress tracking
      clearInterval(statusInterval);
      
      logProgress(currentRequest, "Replicate API call completed successfully");
      logProgress(currentRequest, `Output received: ${JSON.stringify(output)}`);
      
      currentStep = "processing_output";
      
      // Calculate generation time
      const generationTime = (Date.now() - startTime) / 1000; // in seconds
      
      // Get the mesh URL from the output
      let modelUrl;
      if (typeof output === 'object' && output !== null && 'mesh' in output) {
        modelUrl = (output as any).mesh;
      } else if (Array.isArray(output) && output.length > 0) {
        modelUrl = output[0];
      } else {
        modelUrl = String(output);
      }
      
      // Verify the model URL looks valid
      if (!modelUrl || typeof modelUrl !== 'string' || !modelUrl.startsWith('http')) {
        logProgress(currentRequest, `Invalid model URL received: ${modelUrl}`);
        return NextResponse.json(
          { 
            error: 'Invalid model URL received from Replicate API',
            details: `Received: ${modelUrl}`,
            currentStep
          },
          { status: 500 }
        );
      }
      
      logProgress(currentRequest, `3D model generated successfully in ${generationTime.toFixed(2)}s: ${modelUrl}`);
      
      // Return model URL and generation details
      return NextResponse.json({
        modelUrl,
        generationTime,
        sourceImageUrl: imageUrl || null,
        prompt
      });
      
    } catch (replicateError) {
      // Stop progress tracking
      clearInterval(statusInterval);
      
      logProgress(currentRequest, `Replicate API error: ${replicateError instanceof Error ? replicateError.message : String(replicateError)}`);
      
      // Detailed logging of error response if available
      if (replicateError && (replicateError as any).response) {
        try {
          logProgress(currentRequest, `Error response: ${JSON.stringify((replicateError as any).response, null, 2)}`);
        } catch (e) {
          logProgress(currentRequest, "Could not stringify error response");
        }
      }
      
      // Check for specific error types and provide helpful messages
      const errorMessage = replicateError instanceof Error ? replicateError.message : String(replicateError);
      
      // Handle timeout specifically
      if (errorMessage.includes('timed out')) {
        logProgress(currentRequest, `Request timed out after ${API_TIMEOUT_MS/1000} seconds`);
        return NextResponse.json(
          { 
            error: '3D model generation is taking longer than expected. Please try again with a simpler prompt or image.',
            timeoutDetails: `The operation timed out after ${API_TIMEOUT_MS/1000} seconds. The Hunyuan3D-2 model requires significant processing time.`,
            isTimeout: true,
            currentStep
          },
          { status: 504 }
        );
      } else if (errorMessage.includes('402') || errorMessage.includes('Payment Required')) {
        return NextResponse.json(
          { 
            error: 'Payment required for this model. Please set up billing on Replicate.',
            details: errorMessage,
            currentStep 
          },
          { status: 402 }
        );
      } else if (errorMessage.includes('422') || errorMessage.includes('Invalid version')) {
        return NextResponse.json(
          { 
            error: 'Invalid Hunyuan3D-2 model version. Please try again with different parameters.',
            details: errorMessage,
            currentStep
          },
          { status: 422 }
        );
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please try again later.',
            details: errorMessage,
            currentStep
          },
          { status: 429 }
        );
      }
      
      // Generic error case
      return NextResponse.json(
        { 
          error: `Error calling Replicate API: ${errorMessage}`,
          currentStep 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logProgress(currentRequest, `Unexpected error generating 3D model: ${error instanceof Error ? error.message : String(error)}`);
    
    // Check if the error is a timeout from Vercel
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
      return NextResponse.json(
        { 
          error: '3D model generation timed out. Hunyuan3D-2 takes 2-3 minutes to generate models.',
          details: 'Please try again with a simpler prompt or image. Complex images may require more processing time.',
          isTimeout: true,
          currentStep
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred while generating the 3D model',
        details: errorMessage,
        currentStep
      },
      { status: 500 }
    );
  }
} 