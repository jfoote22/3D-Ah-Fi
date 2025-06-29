import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY environment variable is not set" },
      { status: 500 }
    );
  }

  try {
    const { thing, action, negativePrompt } = await request.json();

    if (!thing || !action) {
      return NextResponse.json(
        { error: "Both 'thing' and 'action' parameters are required" },
        { status: 400 }
      );
    }

    console.log("Coloring Book API - Generating prompt for:", { thing, action });

    // Use Claude to generate a coloring book prompt
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please create a detailed image generation prompt for: A ${thing} ${action}. The prompt should describe this as a clean black and white line art drawing suitable for a children's coloring book. Include details about simple bold outlines, no shading or colors, clean simple style, centered on white background. Make it a clear, detailed prompt that will generate a great coloring page when used with an AI image generator.`
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

    // Now generate the actual image using the text-to-image API
    const imageResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: generatedPrompt,
        aspect_ratio: '1:1',
        numberOfImages: 1,
        negativePrompt: finalNegativePrompt
      }),
    });

    if (!imageResponse.ok) {
      const errorData = await imageResponse.json();
      throw new Error(errorData.error || 'Failed to generate coloring book image');
    }

    const imageData = await imageResponse.json();

    return NextResponse.json({
      generatedPrompt,
      imageUrl: imageData.imageUrl,
      thing,
      action,
      model: "Claude + Imagen-4-Fast",
      generationTime: imageData.generationTime
    });

  } catch (error) {
    console.error("Error in Anthropic Coloring Book API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate coloring book" },
      { status: 500 }
    );
  }
} 