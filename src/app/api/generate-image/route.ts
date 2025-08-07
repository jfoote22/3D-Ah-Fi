import { NextResponse } from 'next/server';
import Replicate from 'replicate';

import { logger, performanceLogger } from '@/lib/utils/logger';

// Model configuration
const MODEL_ID = "google/imagen-4-fast";
const MODEL_NAME = "Google Imagen-4-Fast";

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substr(2, 9);
  performanceLogger.start(`image-generation-${requestId}`);
  
  try {
    // Validate request body
    let reqBody;
    try {
      reqBody = await req.json();
      logger.debug('Image generation request received', { requestId });
    } catch (e) {
      logger.error('Failed to parse request body', e);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { 
      prompt, 
      aspect_ratio = "1:1",
      numberOfImages = 1,
      seed,
      negativePrompt,
      personGeneration = 'allow_adult'
    } = reqBody;
    
    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      logger.error('Invalid prompt provided');
      return NextResponse.json(
        { error: 'Prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    logger.debug('Processing prompt', { prompt: prompt.substring(0, 50) + '...' });
    
    // Make sure we have the API token
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      logger.error('Missing REPLICATE_API_TOKEN');
      return NextResponse.json(
        { error: "API configuration error: REPLICATE_API_TOKEN is not set" },
        { status: 500 }
      );
    }
    
    try {
      const replicate = new Replicate({
        auth: apiToken,
      });

      logger.debug('Starting image generation');
      const startTime = Date.now();
      
      // Prepare input parameters for Imagen-4-Fast
      const inputParams: any = {
        prompt,
        aspect_ratio: aspect_ratio // Can be "1:1", "4:3", "3:4", "16:9", "9:16"
      };

      // Add optional parameters if provided
      if (seed !== undefined && seed !== null) {
        inputParams.seed = seed;
      }
      if (negativePrompt && negativePrompt.trim()) {
        inputParams.negative_prompt = negativePrompt.trim();
      }
      if (personGeneration !== 'allow_adult') {
        inputParams.person_generation = personGeneration;
      }
      
      // Use Google Imagen-4-Fast model
      let output;
      try {
        output = await replicate.run(MODEL_ID, {
          input: inputParams
        }) as unknown as string;
        
        logger.debug('Replicate API call successful', { outputType: typeof output });
      } catch (replicateError) {
        logger.error('Replicate API error', replicateError);
        
        // Check for specific error types and provide helpful messages
        const errorMessage = replicateError instanceof Error ? replicateError.message : String(replicateError);
        
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
      
      // Validate output for Imagen-4-Fast (returns single string URL)
      if (!output || typeof output !== 'string') {
        logger.error('Invalid output from Replicate', output);
        return NextResponse.json(
          { error: 'Received invalid response from image generation service' },
          { status: 500 }
        );
      }

      // Calculate generation time
      const generationTime = (Date.now() - startTime) / 1000;
      performanceLogger.end(`image-generation-${requestId}`);
      
      logger.info('Image generated successfully', { 
        generationTime: generationTime.toFixed(2) + 's',
        model: MODEL_NAME 
      });
      
      // Return image URL and generation details
      return NextResponse.json({
        imageUrl: output,
        model: MODEL_NAME,
        modelId: MODEL_ID,
        aspect_ratio: aspect_ratio,
        generationTime,
        prompt,
        numberOfImages,
        seed: seed || null,
        negativePrompt: negativePrompt || null,
        personGeneration
      });
    } catch (initError) {
      logger.error('Failed to initialize Replicate client', initError);
      return NextResponse.json(
        { error: `Failed to initialize the image generation service: ${String(initError)}` },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Unexpected error generating image', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while generating the image' },
      { status: 500 }
    );
  }
} 