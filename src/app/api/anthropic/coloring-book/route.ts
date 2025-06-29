import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import Replicate from "replicate";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Set max duration for Vercel
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY environment variable is not set" },
      { status: 500 }
    );
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN environment variable is not set" },
      { status: 500 }
    );
  }

  try {
    const { thing, action, style, negativePrompt } = await request.json();

    if (!thing || !action) {
      return NextResponse.json(
        { error: "Both 'thing' and 'action' parameters are required" },
        { status: 400 }
      );
    }

    console.log("Coloring Book API - Generating prompt for:", { thing, action, style });

    // Create the prompt with variable substitution
    const promptTemplate = `A ${thing} ${action} in the style of ${style || 'cartoon'}, drawn in clean black and white line art style, similar to comic graphic novels or to children's coloring books. No shading or color, just bold outlines, centered, on a white background.`;

    // Use Claude to generate a coloring book prompt with updated parameters
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      temperature: 1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert prompt engineer for AI image generation. Create a detailed, professional prompt for generating a coloring book style image based on this request: "${promptTemplate}". 

The output should be a clean black and white line art illustration perfect for a children's coloring book. Focus on:
- Bold, clean outlines with no shading or fill
- Simple shapes suitable for coloring
- Child-friendly and appealing design
- Pure white background
- Solid black lines of even thickness

Return only the image generation prompt, nothing else.`
            }
          ]
        }
      ]
    });

    // Extract the generated prompt
    const generatedPrompt = message.content[0]?.type === 'text' 
      ? message.content[0].text 
      : 'A coloring book style drawing with bold outlines';

    console.log("Coloring Book API - Generated prompt:", generatedPrompt);

    // Prepare the negative prompt - combine user's negative prompt with coloring book defaults
    const defaultColoringNegative = 'colors, shading, photorealistic, realistic, painting, complex backgrounds, detailed textures';
    const finalNegativePrompt = negativePrompt 
      ? `${defaultColoringNegative}, ${negativePrompt}` 
      : defaultColoringNegative;

    console.log("Coloring Book API - Using negative prompt:", finalNegativePrompt);

    // Generate the image directly using Replicate (avoiding internal API calls)
    const startTime = Date.now();
    
    const output = await replicate.run("google/imagen-4-fast", {
      input: {
        prompt: generatedPrompt,
        aspect_ratio: "1:1",
        negative_prompt: finalNegativePrompt
      }
    });

    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const imageUrl = Array.isArray(output) ? output[0] : output;

    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Failed to generate image - no valid URL returned');
    }

    return NextResponse.json({
      generatedPrompt,
      imageUrl,
      thing,
      action,
      style: style || 'cartoon',
      model: "Claude 3.5 Sonnet + Imagen-4-Fast",
      generationTime: `${generationTime}s`
    });

  } catch (error) {
    console.error("Error in Anthropic Coloring Book API:", error);
    
    // Enhanced error logging for debugging
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to generate coloring book",
        debug: process.env.NODE_ENV === 'development' ? {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          stack: error instanceof Error ? error.stack : undefined
        } : undefined
      },
      { status: 500 }
    );
  }
} 