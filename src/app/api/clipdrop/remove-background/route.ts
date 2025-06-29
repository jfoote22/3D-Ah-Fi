import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const CLIPDROP_API_KEY = process.env.CLIPDROP_API_KEY || '54762628177e68abbd17604f6142fe55f5a76a2d3cfefa1a06621c586e362920dabf8f74dcad5b25a8493c8aa21bd088';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image_file') as File;
    
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