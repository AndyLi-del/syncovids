// Import Firebase SDK (using CDN modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyA_L95sLaYci8Q_YEq0YlwTWvBXzVeMLwc",
    authDomain: "syncovids-675e7.firebaseapp.com",
    projectId: "syncovids-675e7",
    storageBucket: "syncovids-675e7.firebasestorage.app",
    messagingSenderId: "851491927348",
    appId: "1:851491927348:web:580e17a9526d86b6a06161",
    measurementId: "G-4FN8FZJN52"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
