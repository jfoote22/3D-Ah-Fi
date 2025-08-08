import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/firebase'
import { addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'

interface CreationInput {
  type: 'image' | '3d-model' | 'coloring-book' | 'background-removed'
  prompt: string
  imageUrl?: string
  modelUrl?: string
  backgroundRemovedUrl?: string
  sourceImageId?: string
  aspectRatio?: string
  model?: string
  metadata?: Record<string, any>
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const baseQuery = [where('userId', '==', userId)] as any[]
    if (type) {
      baseQuery.push(where('type', '==', type))
    }

    const q = query(collection(db, 'creations'), ...baseQuery)
    const snapshot = await getDocs(q)

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }))

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[CREATIONS][GET] Error:', error)
    return NextResponse.json({ error: 'Failed to load creations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, items } = body as { userId?: string; items?: CreationInput[] }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items to save' }, { status: 400 })
    }

    const creationsCol = collection(db, 'creations')
    const results: { id: string }[] = []

    for (const item of items) {
      const payload = {
        type: item.type,
        prompt: item.prompt,
        imageUrl: item.imageUrl || null,
        modelUrl: item.modelUrl || null,
        backgroundRemovedUrl: item.backgroundRemovedUrl || null,
        sourceImageId: item.sourceImageId || null,
        aspectRatio: item.aspectRatio || null,
        model: item.model || null,
        metadata: item.metadata || {},
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      const ref = await addDoc(creationsCol, payload)
      results.push({ id: ref.id })
    }

    return NextResponse.json({ success: true, created: results })
  } catch (error) {
    console.error('[CREATIONS][POST] Error:', error)
    return NextResponse.json({ error: 'Failed to save creations' }, { status: 500 })
  }
} 