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
      model: "claude-sonnet-4-20250514",
      max_tokens: 20000,
      temperature: 1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptTemplate
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
      style: style || 'cartoon',
      model: "Claude Sonnet 4 + Imagen-4-Fast",
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