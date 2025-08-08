import { auth, db, storage } from "./firebase";
import {
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Auth functions
export const logoutUser = () => signOut(auth);

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

// Firestore generic helpers
export const addDocument = (collectionName: string, data: any) =>
  addDoc(collection(db, collectionName), data);

export const getDocuments = async (collectionName: string) => {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const updateDocument = (collectionName: string, id: string, data: any) =>
  updateDoc(doc(db, collectionName, id), data);

export const deleteDocument = (collectionName: string, id: string) =>
  deleteDoc(doc(db, collectionName, id));

// Storage helpers
export const uploadFile = async (file: File, path: string) => {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
};

// Creations helpers
export type CreationType = 'image' | '3d-model' | 'coloring-book' | 'background-removed'

export interface CreationInput {
  type: CreationType
  prompt: string
  imageUrl?: string
  modelUrl?: string
  backgroundRemovedUrl?: string
  sourceImageId?: string
  aspectRatio?: string
  model?: string
  metadata?: Record<string, any>
}

export const saveCreations = async (userId: string, items: CreationInput[]) => {
  const creationsCol = collection(db, 'creations')
  const ids: string[] = []
  for (const item of items) {
    const payload = {
      ...item,
      userId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }
    const ref = await addDoc(creationsCol, payload)
    ids.push(ref.id)
  }
  return ids
}

export const saveCreation = async (userId: string, item: CreationInput) => {
  const [id] = await saveCreations(userId, [item])
  return id
}

export const listUserCreations = async (userId: string, type?: CreationType) => {
  const base = [where('userId', '==', userId)] as any[]
  if (type) base.push(where('type', '==', type))
  const q = query(collection(db, 'creations'), ...base)
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export const deleteCreationById = (id: string) => deleteDoc(doc(db, 'creations', id))

// Prompts helpers
export interface SavedPrompt {
  id?: string
  userId: string
  text: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
  metadata?: Record<string, any>
}

export const savePrompt = async (userId: string, text: string, metadata?: Record<string, any>) => {
  const ref = await addDoc(collection(db, 'prompts'), {
    userId,
    text,
    metadata: metadata || {},
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}

export const listUserPrompts = async (userId: string) => {
  const qy = query(collection(db, 'prompts'), where('userId', '==', userId))
  const snap = await getDocs(qy)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SavedPrompt[]
}

export const deletePromptById = async (id: string) => deleteDoc(doc(db, 'prompts', id))
