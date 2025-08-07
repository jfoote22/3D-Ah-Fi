import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Hardcoded configuration - use this directly instead of relying on environment variables
// that might have formatting issues
const firebaseConfig = {
  apiKey: "AIzaSyBjBbkqka_omkqkTwH_YmUS2PDJsG-snio",
  authDomain: "test2-21fd5.firebaseapp.com",
  projectId: "test2-21fd5",
  storageBucket: "test2-21fd5.firebasestorage.app",
  messagingSenderId: "952438236726",
  appId: "1:952438236726:web:b028325932d46d0c869a97",
};

// Log the configuration for debugging
console.log('Firebase config being used:', {
  apiKeyPrefix: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 5)}...` : 'not set',
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket
});

// Initialize Firebase
let app;
try {
  if (getApps().length) {
    app = getApp();
    console.log('Retrieved existing Firebase app');
  } else {
    app = initializeApp(firebaseConfig);
    console.log('Initialized new Firebase app successfully');
  }
} catch (error) {
  console.error('Failed to initialize Firebase app:', error);
  throw error; // Rethrow to make initialization failures very visible
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Log auth initialization
console.log('Firebase Auth initialized:', {
  currentUser: auth.currentUser ? auth.currentUser.email : 'No current user',
  authDomain: firebaseConfig.authDomain
});

export { app, auth, db, storage };
