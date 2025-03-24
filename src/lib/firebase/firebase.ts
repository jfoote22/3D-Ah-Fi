import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Fallback configuration in case environment variables are not set
const fallbackConfig = {
  apiKey: "AIzaSyBjBbkqka_omkqkTwH_YmUS2PDJsG-snio",
  authDomain: "test2-21fd5.firebaseapp.com",
  projectId: "test2-21fd5",
  storageBucket: "test2-21fd5.firebasestorage.app",
  messagingSenderId: "952438236726",
  appId: "1:952438236726:web:b028325932d46d0c869a97",
};

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || fallbackConfig.appId,
};

// Add some debugging logs in development to ensure configuration is working
if (process.env.NODE_ENV !== 'production') {
  console.log('Firebase initialization with config:', 
    { 
      apiKeyPrefix: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 5) + '...' : 'not set',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId
    }
  );
}

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
