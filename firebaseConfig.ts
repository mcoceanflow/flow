// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyABeuPcpSnpoucjyxiwZ5KZJ4aaBRZxYb8",
  authDomain: "flow-ceab3.firebaseapp.com",
  projectId: "flow-ceab3",
  storageBucket: "flow-ceab3.firebasestorage.app",
  messagingSenderId: "348848952660",
  appId: "1:348848952660:web:1866a19894164ac7b8e4c1",
};

const app = initializeApp(firebaseConfig);

// experimentalForceLongPolling avoids a common Firestore/React Native connection issue
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});