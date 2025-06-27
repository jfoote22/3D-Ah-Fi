import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const filename = searchParams.get('filename') || 'download.png';

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Fetch the image from the external URL
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';

    // Return the image with proper headers for download
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': imageBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading image:', error);
    return NextResponse.json({ error: 'Failed to download image' }, { status: 500 });
  }
} 