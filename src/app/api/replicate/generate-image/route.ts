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

  const { prompt, aspect_ratio = "1:1" } = await request.json();

  try {
    const output = await replicate.run("google/imagen-4-fast", {
      input: {
        prompt: prompt,
        aspect_ratio: aspect_ratio, // Can be "1:1", "4:3", "3:4", "16:9", "9:16"
      },
    });

    return NextResponse.json({ output }, { status: 200 });
  } catch (error) {
    console.error("Error from Replicate API:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
