// ============================================================
// PEGA AQUÍ el bloque "firebaseConfig" que te dio Firebase
// (Configuración del proyecto → Tus apps → ícono web </>)
// ============================================================
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCa1hM6SatBbY7_BtpK4O2gC3keFrhvM_w",
  authDomain: "sumaj-illari-21769.firebaseapp.com",
  projectId: "sumaj-illari-21769",
  storageBucket: "sumaj-illari-21769.firebasestorage.app",
  messagingSenderId: "406086823106",
  appId: "1:406086823106:web:f38500621ab0a89ce59f5b",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
