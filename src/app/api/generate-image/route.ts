import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Keep track of request count for debugging
let requestCount = 0;

// Model info - keeping it as a constant for reference
// Updated to use Stable Diffusion XL 3.5 model
const MODEL_ID = "stability-ai/sdxl:c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316";
const MODEL_NAME = "Stable Diffusion XL 3.5";

export async function POST(req: Request) {
  requestCount++;
  const currentRequest = requestCount;
  console.log(`[DEBUG][Request #${currentRequest}] Starting image generation request at ${new Date().toISOString()}`);
  
  try {
    // Validate request body
    let reqBody;
    try {
      reqBody = await req.json();
      console.log(`[DEBUG][Request #${currentRequest}] Request body parsed successfully:`, reqBody);
    } catch (e) {
      console.error(`[DEBUG][Request #${currentRequest}] Failed to parse request body:`, e);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { prompt } = reqBody;
    
    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      console.error(`[DEBUG][Request #${currentRequest}] Missing or invalid prompt`);
      return NextResponse.json(
        { error: 'Prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    console.log(`[DEBUG][Request #${currentRequest}] Received prompt: "${prompt}"`);
    
    // Make sure we have the API token
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      console.error(`[DEBUG][Request #${currentRequest}] Missing API token`);
      return NextResponse.json(
        { error: "API configuration error: REPLICATE_API_TOKEN is not set" },
        { status: 500 }
      );
    }
    
    console.log(`[DEBUG][Request #${currentRequest}] Using Replicate API token: ${apiToken.substring(0, 5)}...`);
    
    try {
      console.log(`[DEBUG][Request #${currentRequest}] Creating Replicate client`);
      const replicate = new Replicate({
        auth: apiToken,
      });

      console.log(`[DEBUG][Request #${currentRequest}] Generating image for prompt: "${prompt}"`);
      
      // Define generation parameters - optimized for SDXL 3.5
      const width = 1024;
      const height = 1024;
      const inferenceSteps = 25;
      const guidanceScale = 7.5;
      
      // Start timing
      const startTime = Date.now();
      
      // Prepare input params for debugging
      const inputParams = {
        prompt,
        width,
        height,
        num_outputs: 1,
        num_inference_steps: inferenceSteps,
        guidance_scale: guidanceScale,
        apply_watermark: false,
        scheduler: "K_EULER"
      };
      console.log(`[DEBUG][Request #${currentRequest}] Input parameters:`, inputParams);
      
      // Use Stable Diffusion XL 3.5 model
      let output;
      try {
        console.log(`[DEBUG][Request #${currentRequest}] Calling Replicate API with model ID: ${MODEL_ID}`);
        output = await replicate.run(
          MODEL_ID,
          {
            input: inputParams
          }
        ) as string[];
        
        console.log(`[DEBUG][Request #${currentRequest}] Replicate API call successful`);
        if (Array.isArray(output)) {
          console.log(`[DEBUG][Request #${currentRequest}] Received ${output.length} outputs, first output prefix:`, 
            output[0]?.substring(0, 50) + '...');
        } else {
          console.log(`[DEBUG][Request #${currentRequest}] Output is not an array:`, typeof output);
        }
      } catch (replicateError) {
        console.error(`[DEBUG][Request #${currentRequest}] Replicate API error:`, replicateError);
        
        // Check if there's detailed error information
        if (replicateError && (replicateError as any).response) {
          try {
            console.error(`[DEBUG][Request #${currentRequest}] Error response:`, JSON.stringify((replicateError as any).response));
          } catch (e) {
            console.error(`[DEBUG][Request #${currentRequest}] Could not stringify error response`);
          }
        }
        
        // Check for specific error types and provide helpful messages
        const errorMessage = replicateError instanceof Error ? replicateError.message : String(replicateError);
        console.error(`[DEBUG][Request #${currentRequest}] Error message:`, errorMessage);
        
        if (errorMessage.includes('402') || errorMessage.includes('Payment Required')) {
          return NextResponse.json(
            { error: 'Payment required for this model. Please set up billing on Replicate.' },
            { status: 402 }
          );
        } else if (errorMessage.includes('422') || errorMessage.includes('Invalid version')) {
          return NextResponse.json(
            { error: 'Invalid model version or not permitted to use this model.' },
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
      
      // Validate output
      if (!output || !Array.isArray(output) || output.length === 0 || typeof output[0] !== 'string') {
        console.error(`[DEBUG][Request #${currentRequest}] Invalid output from Replicate:`, output);
        return NextResponse.json(
          { error: 'Received invalid response from image generation service' },
          { status: 500 }
        );
      }

      // Calculate generation time
      const generationTime = (Date.now() - startTime) / 1000; // in seconds
      
      console.log(`[DEBUG][Request #${currentRequest}] Image generated successfully in ${generationTime.toFixed(2)}s`);
      
      // Return image URL and generation details
      return NextResponse.json({
        imageUrl: output[0],
        model: MODEL_NAME,
        modelId: MODEL_ID,
        width,
        height,
        inferenceSteps,
        guidanceScale,
        generationTime,
        prompt
      });
    } catch (initError) {
      console.error(`[DEBUG][Request #${currentRequest}] Error initializing Replicate client:`, initError);
      return NextResponse.json(
        { error: `Failed to initialize the image generation service: ${String(initError)}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[DEBUG][Request #${currentRequest}] Unexpected error generating image:`, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating the image' },
      { status: 500 }
    );
  }
} 