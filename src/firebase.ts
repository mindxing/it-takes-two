import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBseo9xfv5dd8e_0G47qm_bUNUW42fXd_Y",
  authDomain: "it-takes-two-5794c.firebaseapp.com",
  projectId: "it-takes-two-5794c",
  storageBucket: "it-takes-two-5794c.firebasestorage.app",
  messagingSenderId: "18956015188",
  appId: "1:18956015188:web:1f05f05a552a064789bfc1"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

