import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyA-jag4s92VCAtmyZHbVZwHV6jPc5V9qNw",
  authDomain: "maestriagrill.firebaseapp.com",
  projectId: "maestriagrill",
  storageBucket: "maestriagrill.firebasestorage.app",
  messagingSenderId: "390319087399",
  appId: "1:390319087399:web:ab7e64855fe8c922669302"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with the specific databaseId
export const db = getFirestore(app, "ai-studio-remixcardpiopedi-c19002e5-a774-4fa4-b5c1-2ec6813226c9");

export const auth = getAuth(app);

export const storage = getStorage(app);

