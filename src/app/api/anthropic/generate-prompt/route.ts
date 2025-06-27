import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.trim() === "") {
    return NextResponse.json({
      error: "The ANTHROPIC_API_KEY environment variable is not set or is empty. Please add your Anthropic API key to your .env.local file.",
      disabled: true
    }, { status: 503 });
  }

  try {
    const { template, variables } = await request.json();

    if (!template) {
      return NextResponse.json({ error: "Template is required" }, { status: 400 });
    }

    console.log("Anthropic Prompt Generation - Input:", { template, variables });

    // Replace variables in the template
    let processedTemplate = template;
    if (variables && typeof variables === 'object') {
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value as string);
      });
    }

    console.log("Anthropic Prompt Generation - Processed template:", processedTemplate);

    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      maxTokens: 4000,
      temperature: 1,
      system: "You are an expert prompt engineer for AI image generation. Your task is to create detailed, professional prompts for 3D model generation that will produce high-quality, photorealistic results. Focus on technical specifications, lighting, materials, and visual composition that would be suitable for commercial use.",
      prompt: processedTemplate,
    });

    console.log("Anthropic Prompt Generation - Response:", text);

    if (!text) {
      throw new Error("No prompt generated from Anthropic");
    }

    return NextResponse.json({
      generatedPrompt: text,
      originalTemplate: template,
      processedTemplate,
      variables
    }, { status: 200 });

  } catch (error) {
    console.error("Error generating prompt with Anthropic:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to generate prompt"
    }, { status: 500 });
  }
} 