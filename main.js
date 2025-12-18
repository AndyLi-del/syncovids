import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const messagesBtn = document.getElementById('messages-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        signinBtn.style.display = 'none';
        exploreBtn.style.display = 'inline-block';
        messagesBtn.style.display = 'inline-block';
        videosBtn.style.display = 'inline-block';
        dashboardBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';
    } else {
        // User is not signed in
        signinBtn.style.display = 'inline-block';
        exploreBtn.style.display = 'none';
        messagesBtn.style.display = 'none';
        videosBtn.style.display = 'none';
        dashboardBtn.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
    }
});
