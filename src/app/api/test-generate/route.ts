import { NextResponse } from 'next/server';

// Temporary test endpoint to verify UI is working without external APIs
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;
    
    // Return a mock response with a placeholder image
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate generation time
    
    return NextResponse.json({
      imageUrl: 'https://via.placeholder.com/512x512/4F46E5/FFFFFF?text=' + encodeURIComponent(prompt.slice(0, 20)),
      model: 'Test Generator',
      modelId: 'test-model',
      aspect_ratio: '1:1',
      generationTime: 2.0,
      prompt: prompt,
      numberOfImages: 1,
      seed: Math.floor(Math.random() * 1000000),
    });
    
  } catch (error) {
    console.error('Test generation error:', error);
    return NextResponse.json(
      { error: 'Test generation failed' },
      { status: 500 }
    );
  }
}