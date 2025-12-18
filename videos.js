import { db, auth, storage } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, listAll, getDownloadURL, getMetadata, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');
const videosGrid = document.getElementById('videos-grid');
const loading = document.getElementById('loading');
const noVideos = document.getElementById('no-videos');

let currentUser = null;

// Video file extensions
const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];

function isVideoFile(filename) {
    const lower = filename.toLowerCase();
    return videoExtensions.some(ext => lower.endsWith(ext));
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

        // Load user's videos
        await loadVideos(user.uid);
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

async function loadVideos(uid) {
    try {
        const userFilesRef = ref(storage, `users/${uid}/files`);
        const result = await listAll(userFilesRef);

        // Filter for video files only
        const videoItems = [];

        for (const item of result.items) {
            if (isVideoFile(item.name)) {
                try {
                    const url = await getDownloadURL(item);
                    const metadata = await getMetadata(item);
                    videoItems.push({
                        name: item.name,
                        fullPath: item.fullPath,
                        url: url,
                        metadata: metadata
                    });
                } catch (error) {
                    console.error('Error getting video:', error);
                }
            }
        }

        loading.style.display = 'none';

        if (videoItems.length === 0) {
            noVideos.style.display = 'block';
            return;
        }

        // Sort by upload time (newest first)
        videoItems.sort((a, b) => {
            const timeA = new Date(a.metadata.timeCreated).getTime();
            const timeB = new Date(b.metadata.timeCreated).getTime();
            return timeB - timeA;
        });

        // Render videos
        renderVideos(videoItems);
    } catch (error) {
        console.error('Error loading videos:', error);
        loading.textContent = 'Error loading videos';

        // If folder doesn't exist yet, show no videos message
        if (error.code === 'storage/object-not-found') {
            loading.style.display = 'none';
            noVideos.style.display = 'block';
        }
    }
}

function renderVideos(videos) {
    videosGrid.innerHTML = '';

    videos.forEach(video => {
        const videoCard = document.createElement('div');
        videoCard.className = 'video-card';

        // Extract display name (remove timestamp prefix)
        const displayName = video.name.replace(/^\d+_/, '');
        const uploadDate = new Date(video.metadata.timeCreated).toLocaleDateString();
        const fileSize = formatFileSize(video.metadata.size);

        const playerUrl = `player.html?path=${encodeURIComponent(video.fullPath)}`;

        videoCard.innerHTML = `
            <a href="${playerUrl}" class="video-link">
                <div class="video-wrapper">
                    <video src="${video.url}" preload="metadata"></video>
                    <div class="video-overlay">
                        <button class="play-btn">▶</button>
                    </div>
                </div>
                <div class="video-info">
                    <h3 class="video-title" title="${displayName}">${displayName}</h3>
                    <p class="video-meta">${uploadDate} • ${fileSize}</p>
                </div>
            </a>
            <div class="video-actions">
                <a href="${video.url}" target="_blank" class="btn-action btn-download" download="${displayName}">Download</a>
                <button class="btn-action btn-delete" data-path="${video.fullPath}">Delete</button>
            </div>
        `;

        // Delete handler
        const deleteBtn = videoCard.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this video?')) {
                await deleteVideo(video.fullPath, videoCard);
            }
        });

        videosGrid.appendChild(videoCard);
    });
}

async function deleteVideo(path, cardElement) {
    try {
        const videoRef = ref(storage, path);
        await deleteObject(videoRef);
        cardElement.remove();

        // Check if no videos left
        if (videosGrid.children.length === 0) {
            noVideos.style.display = 'block';
        }
    } catch (error) {
        console.error('Error deleting video:', error);
        alert('Failed to delete video');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
