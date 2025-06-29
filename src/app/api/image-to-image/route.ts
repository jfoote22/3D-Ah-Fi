import { NextResponse } from 'next/server';
import Replicate from 'replicate';

// Keep track of request count for debugging
let requestCount = 0;

// Model info for image-to-image generation
const MODEL_ID = "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc";
const MODEL_NAME = "Stability AI SDXL";

export async function POST(req: Request) {
  requestCount++;
  const currentRequest = requestCount;
  console.log(`[DEBUG][Request #${currentRequest}] Starting image-to-image generation request at ${new Date().toISOString()}`);
  
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

    const { 
      prompt, 
      image,
      strength = 0.8,
      guidance_scale = 7.5,
      num_inference_steps = 50,
      seed,
      negative_prompt
    } = reqBody;
    
    // Validate prompt and image
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      console.error(`[DEBUG][Request #${currentRequest}] Missing or invalid prompt`);
      return NextResponse.json(
        { error: 'Prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!image || typeof image !== 'string') {
      console.error(`[DEBUG][Request #${currentRequest}] Missing or invalid image`);
      return NextResponse.json(
        { error: 'Input image is required' },
        { status: 400 }
      );
    }
    
    console.log(`[DEBUG][Request #${currentRequest}] Received prompt: "${prompt}"`);
    console.log(`[DEBUG][Request #${currentRequest}] Received image URL/data: ${image.substring(0, 50)}...`);
    
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

      console.log(`[DEBUG][Request #${currentRequest}] Generating image-to-image for prompt: "${prompt}"`);
      
      // Start timing
      const startTime = Date.now();
      
      // Prepare input params for SDXL image-to-image with optimized defaults for speed
      const inputParams: any = {
        prompt,
        image,
        strength: Math.min(strength, 0.8), // Cap strength to prevent over-processing
        guidance_scale: Math.min(guidance_scale, 7.5), // Optimize guidance scale
        num_inference_steps: Math.min(num_inference_steps, 30), // Reduce steps for faster generation
        scheduler: "K_EULER",
      };

      // Add optional parameters if provided
      if (seed !== undefined && seed !== null) {
        inputParams.seed = seed;
      }
      if (negative_prompt && negative_prompt.trim()) {
        inputParams.negative_prompt = negative_prompt.trim();
      }
      
      console.log(`[DEBUG][Request #${currentRequest}] Input parameters:`, {
        ...inputParams,
        image: `${inputParams.image.substring(0, 50)}...` // Truncate image data for logging
      });
      
      // Use SDXL model for image-to-image with timeout handling
      let output;
      try {
        console.log(`[DEBUG][Request #${currentRequest}] Calling Replicate API with model ID: ${MODEL_ID}`);
        
        // Create a timeout promise (45 seconds for Vercel Pro, 8 seconds for hobby)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout - image generation took too long')), 45000); // 45 seconds
        });
        
        // Race between the API call and timeout
        const apiCall = replicate.run(MODEL_ID, {
          input: inputParams
        }) as Promise<string[]>;
        
        output = await Promise.race([apiCall, timeoutPromise]) as string[];
        
        console.log(`[DEBUG][Request #${currentRequest}] Replicate API call successful`);
        console.log(`[DEBUG][Request #${currentRequest}] Received output type:`, typeof output);
        console.log(`[DEBUG][Request #${currentRequest}] Output length:`, Array.isArray(output) ? output.length : 'not an array');
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
        
        if (errorMessage.includes('timeout') || errorMessage.includes('Request timeout')) {
          return NextResponse.json(
            { error: 'Image generation is taking too long. Try reducing the inference steps or using a simpler prompt.' },
            { status: 408 }
          );
        } else if (errorMessage.includes('402') || errorMessage.includes('Payment Required')) {
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
      
      // Validate output for SDXL (returns array of URLs)
      if (!output || !Array.isArray(output) || output.length === 0) {
        console.error(`[DEBUG][Request #${currentRequest}] Invalid output from Replicate:`, output);
        return NextResponse.json(
          { error: 'Received invalid response from image generation service' },
          { status: 500 }
        );
      }

      // Calculate generation time
      const generationTime = (Date.now() - startTime) / 1000; // in seconds
      
      console.log(`[DEBUG][Request #${currentRequest}] Image-to-image generated successfully in ${generationTime.toFixed(2)}s`);
      
      // Return image URL and generation details
      return NextResponse.json({
        imageUrl: output[0], // Take the first generated image
        model: MODEL_NAME,
        modelId: MODEL_ID,
        strength,
        guidance_scale,
        num_inference_steps,
        generationTime,
        prompt,
        seed: seed || null,
        negative_prompt: negative_prompt || null,
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