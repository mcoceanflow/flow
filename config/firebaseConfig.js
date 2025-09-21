// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBcqKxKalQAem_X5WkGCj_GUgVwalmAYHI",
    authDomain: "flow-a9e95.firebaseapp.com",
    projectId: "flow-a9e95",
    storageBucket: "flow-a9e95.firebasestorage.app",
    messagingSenderId: "518059846894",
    appId: "1:518059846894:web:f4d502cb47427b931a97ff",
    measurementId: "G-RM5J8VE6QS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);