import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Keep track of request count for debugging
let requestCount = 0;

// Use the actual Hunyuan3D-2 model from ndreca
const MODEL_ID = "ndreca/hunyuan3d-2:4ac0c7d1ef7e7dd58bf92364262597272dea79bfdb158b26027f54eb667f28b8";
const MODEL_NAME = "Hunyuan3D-2";

export async function POST(req: Request) {
  requestCount++;
  const currentRequest = requestCount;
  console.log(`[3D Request #${currentRequest}] Starting 3D model generation request`);
  
  try {
    // Validate request body
    let reqBody;
    try {
      reqBody = await req.json();
    } catch (e) {
      console.error(`[3D Request #${currentRequest}] Failed to parse request body:`, e);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { imageUrl, prompt } = reqBody;
    
    // Validate input parameters
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      console.error(`[3D Request #${currentRequest}] Missing or invalid prompt`);
      return NextResponse.json(
        { error: 'Prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    // Log received parameters
    if (imageUrl) {
      console.log(`[3D Request #${currentRequest}] Received image URL: "${imageUrl.substring(0, 30)}..."`);
    } else {
      console.log(`[3D Request #${currentRequest}] No image URL provided, will generate 3D model from prompt only`);
    }
    console.log(`[3D Request #${currentRequest}] Received prompt: "${prompt}"`);
    
    // Make sure we have the API token
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      console.error(`[3D Request #${currentRequest}] Missing API token`);
      return NextResponse.json(
        { error: "API configuration error: REPLICATE_API_TOKEN is not set" },
        { status: 500 }
      );
    }
    
    console.log(`[3D Request #${currentRequest}] Using Replicate API token: ${apiToken.substring(0, 5)}...`);
    
    const replicate = new Replicate({
      auth: apiToken,
    });

    console.log(`[3D Request #${currentRequest}] Generating 3D model with Hunyuan3D-2`);
    
    // Start timing
    const startTime = Date.now();
    
    // Create input parameters based on example
    const input: any = {
      prompt: prompt
    };
    
    // Only add image parameter if imageUrl is provided
    if (imageUrl) {
      input.image = imageUrl;
    }
    
    console.log(`[3D Request #${currentRequest}] Calling Replicate with model ID: ${MODEL_ID}`);
    console.log(`[3D Request #${currentRequest}] Input parameters:`, JSON.stringify(input, null, 2));
    
    try {
      // Use the simpler run method as shown in the example
      const output = await replicate.run(
        MODEL_ID,
        { input }
      );

      console.log(`[3D Request #${currentRequest}] Output received:`, output);
      
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
      
      console.log(`[3D Request #${currentRequest}] 3D model generated successfully in ${generationTime.toFixed(2)}s:`, modelUrl);
      
      // Return model URL and generation details
      return NextResponse.json({
        modelUrl,
        generationTime,
        sourceImageUrl: imageUrl || null,
        prompt
      });
      
    } catch (replicateError) {
      console.error(`[3D Request #${currentRequest}] Replicate API error:`, replicateError);
      
      // Detailed logging of error response if available
      if (replicateError && (replicateError as any).response) {
        try {
          console.error(`[3D Request #${currentRequest}] Error response:`, 
            JSON.stringify((replicateError as any).response, null, 2));
        } catch (e) {
          console.error(`[3D Request #${currentRequest}] Could not stringify error response`);
        }
      }
      
      // Check for specific error types and provide helpful messages
      const errorMessage = replicateError instanceof Error ? replicateError.message : String(replicateError);
      
      if (errorMessage.includes('402') || errorMessage.includes('Payment Required')) {
        return NextResponse.json(
          { error: 'Payment required for this model. Please set up billing on Replicate.' },
          { status: 402 }
        );
      } else if (errorMessage.includes('422') || errorMessage.includes('Invalid version')) {
        return NextResponse.json(
          { error: 'Invalid Hunyuan3D-2 model version. Please try again with different parameters.' },
          { status: 422 }
        );
      } else if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      // Generic error case
      return NextResponse.json(
        { error: `Error calling Replicate API: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[3D Request #${currentRequest}] Unexpected error generating 3D model:`, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating the 3D model' },
      { status: 500 }
    );
  }
} 