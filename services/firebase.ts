import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import * as firestore from "firebase/firestore";
import { getAuth } from "firebase/auth";

const { getFirestore } = firestore as any;

const firebaseConfig = {
  apiKey: "AIzaSyAwcVawpjqQvo78g_T_L_X3C0Px8VVpvp4",
  authDomain: "team-lp-v1.firebaseapp.com",
  projectId: "team-lp-v1",
  storageBucket: "team-lp-v1.firebasestorage.app",
  messagingSenderId: "39001171232",
  appId: "1:39001171232:web:98f450414bf72a0eeea345",
  measurementId: "G-Y1PLB7DC8F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);