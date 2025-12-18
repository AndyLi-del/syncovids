import { db, auth } from "./firebase-config.js";
import { collection, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');
const usersGrid = document.getElementById('users-grid');
const loading = document.getElementById('loading');
const noUsers = document.getElementById('no-users');

let currentUser = null;

// Default profile picture
const defaultProfilePic = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyMCIgZmlsbD0iIzY2NiIvPjxlbGxpcHNlIGN4PSI1MCIgY3k9Ijk1IiByeD0iMzUiIHJ5PSIzMCIgZmlsbD0iIzY2NiIvPjwvc3ZnPg==';

// Sync signed-in user to Firestore
async function syncUserToFirestore(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const existing = await getDoc(userRef);

        // Only create if missing so we don't overwrite existing data
        if (!existing.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                username: user.displayName || user.email.split('@')[0] || 'Anonymous',
                email: user.email || '',
                createdAt: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Error syncing user to Firestore:', error);
    }
}

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        signinBtn.style.display = 'none';
        exploreBtn.style.display = 'inline-block';
        videosBtn.style.display = 'inline-block';
        dashboardBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';

        // Ensure user exists in Firestore
        await syncUserToFirestore(user);

        // Load all users
        await loadUsers();
    } else {
        window.location.href = 'signin.html';
    }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

async function loadUsers() {
    try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);

        loading.style.display = 'none';

        const users = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            // Don't show current user in explore
            if (doc.id !== currentUser.uid) {
                users.push({
                    uid: doc.id,
                    ...userData
                });
            }
        });

        if (users.length === 0) {
            noUsers.style.display = 'block';
            return;
        }

        renderUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
        loading.textContent = 'Error loading users';
    }
}

function renderUsers(users) {
    usersGrid.innerHTML = '';

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = 'user-card';

        const profileUrl = `profile.html?uid=${user.uid}`;
        const profilePic = user.profilePicture || defaultProfilePic;

        userCard.innerHTML = `
            <a href="${profileUrl}" class="user-link">
                <div class="user-avatar">
                    <img src="${profilePic}" alt="${user.username}" onerror="this.src='${defaultProfilePic}'">
                </div>
                <div class="user-details">
                    <h3 class="user-name">${user.username || 'Anonymous'}</h3>
                    <p class="user-joined">Joined ${formatDate(user.createdAt)}</p>
                </div>
            </a>
        `;

        usersGrid.appendChild(userCard);
    });
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
