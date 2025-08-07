import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!CLIPDROP_API_KEY) {
      return NextResponse.json(
        { error: 'ClipDrop API key not configured. Please add CLIPDROP_API_KEY to your environment variables.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    console.log('FormData keys:', Array.from(formData.keys()));
    
    const imageFile = formData.get('image_file') as File;
    console.log('Image file received:', imageFile ? {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type
    } : 'null');
    
    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    // Create form data for Clip Drop API
    const clipDropFormData = new FormData();
    clipDropFormData.append('image_file', imageFile);
    
    // Optional transparency handling parameter
    const transparencyHandling = formData.get('transparency_handling') as string;
    if (transparencyHandling) {
      clipDropFormData.append('transparency_handling', transparencyHandling);
    }

    console.log('🎨 Sending request to Clip Drop API...');
    
    const response = await fetch('https://clipdrop-api.co/remove-background/v1', {
      method: 'POST',
      headers: {
        'x-api-key': CLIPDROP_API_KEY,
      },
      body: clipDropFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Clip Drop API error:', response.status, errorText);
      
      let errorMessage = 'Background removal failed';
      if (response.status === 401) {
        errorMessage = 'Invalid API key';
      } else if (response.status === 402) {
        errorMessage = 'No remaining credits';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please try again later.';
      }
      
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    // Get credit information from headers
    const remainingCredits = response.headers.get('x-remaining-credits');
    const creditsConsumed = response.headers.get('x-credits-consumed');
    
    console.log('✅ Background removal successful!');
    console.log(`💳 Credits remaining: ${remainingCredits}, Credits consumed: ${creditsConsumed}`);

    // Return the image directly as a blob response
    const contentType = response.headers.get('content-type') || 'image/png';
    const imageBlob = await response.blob();
    
    // Create a response with the image data and credit headers
    const responseHeaders = new Headers({
      'Content-Type': contentType,
      'x-remaining-credits': remainingCredits || '0',
      'x-credits-consumed': creditsConsumed || '1',
    });

    return new Response(imageBlob, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('❌ Clip Drop background removal error:', error);
    return NextResponse.json(
      { error: 'Failed to remove background' },
      { status: 500 }
    );
  }
} 