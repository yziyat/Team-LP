
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Helper to safely get environment variables from Vite or Create-React-App
const getEnv = (key: string) => {
  // @ts-ignore - Vite support
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[`VITE_${key}`];
  }
  // @ts-ignore - CRA support
  if (typeof process !== 'undefined' && process.env) {
    // @ts-ignore
    return process.env[`REACT_APP_${key}`];
  }
  return undefined;
};

// Config prioritizes Environment Variables, falls back to hardcoded values for immediate demo functionality.
const firebaseConfig = {
  apiKey: getEnv("FIREBASE_API_KEY") || "AIzaSyAwcVawpjqQvo78g_T_L_X3C0Px8VVpvp4",
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN") || "team-lp-v1.firebaseapp.com",
  projectId: getEnv("FIREBASE_PROJECT_ID") || "team-lp-v1",
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET") || "team-lp-v1.firebasestorage.app",
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID") || "39001171232",
  appId: getEnv("FIREBASE_APP_ID") || "1:39001171232:web:98f450414bf72a0eeea345",
  measurementId: getEnv("FIREBASE_MEASUREMENT_ID") || "G-Y1PLB7DC8F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
