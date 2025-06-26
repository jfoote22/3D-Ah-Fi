import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    console.log('[SAVE-IMAGE] Starting image save request');
    
    const body = await request.json();
    const { imageUrl, prompt, modelUrl, userId } = body;
    
    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl and prompt' },
        { status: 400 }
      );
    }
    
    console.log('[SAVE-IMAGE] Saving image metadata to Firestore');
    
    // Save to Firestore
    const savedImage = {
      imageUrl,
      prompt,
      createdAt: serverTimestamp(),
      userId: userId || 'anonymous',
      ...(modelUrl && { modelUrl })
    };
    
    const docRef = await addDoc(collection(db, 'images'), savedImage);
    console.log('[SAVE-IMAGE] Image saved with ID:', docRef.id);
    
    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Image saved successfully'
    });
    
  } catch (error) {
    console.error('[SAVE-IMAGE] Error saving image:', error);
    return NextResponse.json(
      { 
        error: 'Failed to save image', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 