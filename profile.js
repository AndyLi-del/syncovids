import { db, auth, storage } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, listAll, getDownloadURL, getMetadata } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');
const profileAvatar = document.getElementById('profile-avatar');
const profileUsername = document.getElementById('profile-username');
const profileJoined = document.getElementById('profile-joined');
const videoCount = document.getElementById('video-count');
const videosGrid = document.getElementById('videos-grid');
const loading = document.getElementById('loading');
const noVideos = document.getElementById('no-videos');

let currentUser = null;
let profileUserId = null;

// Default profile picture
const defaultProfilePic = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyMCIgZmlsbD0iIzY2NiIvPjxlbGxpcHNlIGN4PSI1MCIgY3k9Ijk1IiByeD0iMzUiIHJ5PSIzMCIgZmlsbD0iIzY2NiIvPjwvc3ZnPg==';

// Media file extensions
const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma'];

function getMediaType(filename) {
    const lower = filename.toLowerCase();
    if (videoExtensions.some(ext => lower.endsWith(ext))) return 'video';
    if (imageExtensions.some(ext => lower.endsWith(ext))) return 'image';
    if (audioExtensions.some(ext => lower.endsWith(ext))) return 'audio';
    return null;
}

function isMediaFile(filename) {
    return getMediaType(filename) !== null;
}

// Get profile user ID from URL
const params = new URLSearchParams(window.location.search);
profileUserId = params.get('uid');

if (!profileUserId) {
    window.location.href = 'explore.html';
}

// Sync signed-in user to Firestore
async function syncUserToFirestore(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const existing = await getDoc(userRef);

        // Only create if missing so we don't overwrite existing data
        if (!existing.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                username: user.displayName || 'Anonymous',
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

        // Ensure user exists in Firestore with uid, time, username and email
        await syncUserToFirestore(user);

        // Load profile user data
        await loadProfile();
        await loadUserVideos();
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

async function loadProfile() {
    try {
        const userDoc = await getDoc(doc(db, "users", profileUserId));

        if (userDoc.exists()) {
            const userData = userDoc.data();
            profileUsername.textContent = userData.username || 'Anonymous';
            document.title = `${userData.username}'s Profile - Syncovids`;

            if (userData.profilePicture) {
                profileAvatar.src = userData.profilePicture;
            } else {
                profileAvatar.src = defaultProfilePic;
            }

            if (userData.createdAt) {
                const date = new Date(userData.createdAt);
                profileJoined.textContent = `Joined ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
            }
        } else {
            profileUsername.textContent = 'User not found';
            profileAvatar.src = defaultProfilePic;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        profileUsername.textContent = 'Error loading profile';
    }
}

async function loadUserVideos() {
    try {
        const userFilesRef = ref(storage, `users/${profileUserId}/files`);
        const result = await listAll(userFilesRef);

        // Filter for all media files (videos, images, audio)
        const mediaItems = [];

        for (const item of result.items) {
            const mediaType = getMediaType(item.name);
            if (mediaType) {
                try {
                    const url = await getDownloadURL(item);
                    const metadata = await getMetadata(item);
                    mediaItems.push({
                        name: item.name,
                        fullPath: item.fullPath,
                        url: url,
                        metadata: metadata,
                        type: mediaType
                    });
                } catch (error) {
                    console.error('Error getting media:', error);
                }
            }
        }

        loading.style.display = 'none';

        videoCount.textContent = `${mediaItems.length} file${mediaItems.length !== 1 ? 's' : ''}`;

        if (mediaItems.length === 0) {
            noVideos.style.display = 'block';
            return;
        }

        // Sort by upload time (newest first)
        mediaItems.sort((a, b) => {
            const timeA = new Date(a.metadata.timeCreated).getTime();
            const timeB = new Date(b.metadata.timeCreated).getTime();
            return timeB - timeA;
        });

        renderVideos(mediaItems);
    } catch (error) {
        console.error('Error loading media:', error);
        loading.style.display = 'none';

        if (error.code === 'storage/object-not-found') {
            noVideos.style.display = 'block';
            videoCount.textContent = '0 files';
        }
    }
}

function renderVideos(mediaFiles) {
    videosGrid.innerHTML = '';

    mediaFiles.forEach(media => {
        const mediaCard = document.createElement('div');
        mediaCard.className = 'video-card';

        const displayName = media.name.replace(/^\d+_/, '');
        const uploadDate = new Date(media.metadata.timeCreated).toLocaleDateString();
        const fileSize = formatFileSize(media.metadata.size);
        const playerUrl = `player.html?path=${encodeURIComponent(media.fullPath)}`;

        let previewHTML = '';
        let iconHTML = '';

        if (media.type === 'video') {
            previewHTML = `<video src="${media.url}" preload="metadata"></video>`;
            iconHTML = '▶';
        } else if (media.type === 'image') {
            previewHTML = `<img src="${media.url}" alt="${displayName}">`;
            iconHTML = '🖼';
        } else if (media.type === 'audio') {
            previewHTML = `<div class="audio-preview">🎵</div>`;
            iconHTML = '▶';
        }

        mediaCard.innerHTML = `
            <a href="${playerUrl}" class="video-link">
                <div class="video-wrapper">
                    ${previewHTML}
                    <div class="video-overlay">
                        <button class="play-btn">${iconHTML}</button>
                    </div>
                </div>
                <div class="video-info">
                    <h3 class="video-title" title="${displayName}">${displayName}</h3>
                    <p class="video-meta">${uploadDate} • ${fileSize}</p>
                </div>
            </a>
        `;

        videosGrid.appendChild(mediaCard);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
