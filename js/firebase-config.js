import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyDWXONpz_qYg74o0dogTPVKhlXFdtXBb8A",
    authDomain: "dnevnik-1af80.firebaseapp.com",
    projectId: "dnevnik-1af80",
    storageBucket: "dnevnik-1af80.firebasestorage.app",
    messagingSenderId: "738096814881",
    appId: "1:738096814881:web:9cda53b517d37104273c60",
    measurementId: "G-YZX5LWT3DP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);