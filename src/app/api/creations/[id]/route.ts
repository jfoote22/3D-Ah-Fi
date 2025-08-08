import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/firebase'
import { doc, deleteDoc } from 'firebase/firestore'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    await deleteDoc(doc(db, 'creations', id))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CREATIONS][DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to delete creation' }, { status: 500 })
  }
} 