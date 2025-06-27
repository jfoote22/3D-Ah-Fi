import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      "The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it."
    );
  }

  const { 
    imageUrl, 
    prompt,
    prompt_strength = 0.8,
    guidance_scale = 7.5,
    num_inference_steps = 50,
    negative_prompt = "",
    seed = null,
    scheduler = "K_EULER"
  } = await request.json();

  if (!imageUrl) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  try {
    console.log("Coloring Book API - Input parameters:", { 
      imageUrl, 
      prompt: prompt || "A black and white coloring page",
      prompt_strength,
      guidance_scale,
      num_inference_steps,
      negative_prompt,
      seed,
      scheduler
    });

    // For image-to-image conversion to coloring book, we need to use the image parameter
    // and focus the prompt on the coloring book transformation
    const coloringPrompt = "black and white coloring page, line art, simple outlines, no shading, coloring book style";
    
    console.log("Coloring Book API - Using prompt:", coloringPrompt);
    console.log("Coloring Book API - Converting image:", imageUrl);

    const inputParams: any = {
      prompt: coloringPrompt,
      image: imageUrl,
      prompt_strength,
      guidance_scale,
      num_inference_steps,
      scheduler,
    };

    // Add optional parameters if provided
    if (negative_prompt && negative_prompt.trim()) {
      inputParams.negative_prompt = negative_prompt;
    }
    
    if (seed !== null && seed !== undefined) {
      inputParams.seed = parseInt(seed.toString());
    }

    console.log("Coloring Book API - Final input params:", inputParams);

    const output = await replicate.run("pnickolas1/sdxl-coloringbook:d2b110483fdce03119b21786d823f10bb3f5a7c49a7429da784c5017df096d33", {
      input: inputParams,
    });

    console.log("Coloring Book API - Raw output:", output);
    console.log("Coloring Book API - Output type:", typeof output);

    // The output should be an array of image URLs
    const coloringBookUrl = Array.isArray(output) ? output[0] : output;

    console.log("Coloring Book API - Final URL:", coloringBookUrl);

    if (!coloringBookUrl) {
      throw new Error("No coloring book image generated");
    }

    return NextResponse.json({ 
      imageUrl: coloringBookUrl,
      originalImageUrl: imageUrl 
    }, { status: 200 });
  } catch (error) {
    console.error("Error from Replicate Coloring Book API:", error);
    console.error("Full error details:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
} 