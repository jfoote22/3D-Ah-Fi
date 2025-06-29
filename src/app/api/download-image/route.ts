import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const filename = searchParams.get('filename') || 'download.png';

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Check if it's a blob URL (shouldn't happen with the updated frontend, but just in case)
    if (imageUrl.startsWith('blob:')) {
      console.error('Blob URL received in server API - this should not happen:', imageUrl);
      return NextResponse.json({ 
        error: 'Blob URLs cannot be processed server-side. Please download directly from the client.' 
      }, { status: 400 });
    }

    // Validate that it's a proper HTTP/HTTPS URL
    try {
      const url = new URL(imageUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return NextResponse.json({ error: 'Invalid URL protocol. Only HTTP and HTTPS URLs are supported.' }, { status: 400 });
      }
    } catch (urlError) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    console.log('Fetching image from URL:', imageUrl);
    
    // Fetch the image from the external URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageDownloader/1.0)'
        }
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        return NextResponse.json({ 
          error: `Failed to fetch image: ${response.status} ${response.statusText}` 
        }, { status: 500 });
      }

      const imageBuffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      console.log(`Successfully fetched image: ${imageBuffer.byteLength} bytes, content-type: ${contentType}`);

      // Return the image with proper headers for download
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': imageBuffer.byteLength.toString(),
        },
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timeout - image took too long to download' }, { status: 408 });
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('Error downloading image:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to download image' 
    }, { status: 500 });
  }
} 