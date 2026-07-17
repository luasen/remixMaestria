import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase configuration from environment variables or firebase-applet-config.json
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA-jag4s92VCAtmyZHbVZwHV6jPc5V9qNw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "maestriagrill.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "maestriagrill",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "maestriagrill.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "390319087399",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:390319087399:web:ab7e64855fe8c922669302"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific databaseId
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-remixcardpiopedi-c19002e5-a774-4fa4-b5c1-2ec6813226c9";
export const db = getFirestore(app, dbId);

export const auth = getAuth(app);

export const storage = getStorage(app);

