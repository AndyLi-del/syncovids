import { db, auth, storage } from "./firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, listAll, getDownloadURL, getMetadata, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const messagesBtn = document.getElementById('messages-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');
const videosGrid = document.getElementById('videos-grid');
const loading = document.getElementById('loading');
const noVideos = document.getElementById('no-videos');

let currentUser = null;

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
        messagesBtn.style.display = 'inline-block';
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

        // Render media
        renderVideos(mediaItems);
    } catch (error) {
        console.error('Error loading media:', error);
        loading.textContent = 'Error loading media';

        // If folder doesn't exist yet, show no media message
        if (error.code === 'storage/object-not-found') {
            loading.style.display = 'none';
            noVideos.style.display = 'block';
        }
    }
}

function renderVideos(mediaFiles) {
    videosGrid.innerHTML = '';

    mediaFiles.forEach(media => {
        const mediaCard = document.createElement('div');
        mediaCard.className = 'video-card';

        // Extract display name (remove timestamp prefix)
        const displayName = media.name.replace(/^\d+_/, '');
        const uploadDate = new Date(media.metadata.timeCreated).toLocaleDateString();
        const fileSize = formatFileSize(media.metadata.size);

        const playerUrl = `player.html?path=${encodeURIComponent(media.fullPath)}`;

        let previewHTML = '';
        let iconHTML = '';
        let mediaTypeLabel = '';

        if (media.type === 'video') {
            previewHTML = `<video src="${media.url}" preload="metadata"></video>`;
            iconHTML = '▶';
            mediaTypeLabel = 'Video';
        } else if (media.type === 'image') {
            previewHTML = `<img src="${media.url}" alt="${displayName}">`;
            iconHTML = '🖼';
            mediaTypeLabel = 'Image';
        } else if (media.type === 'audio') {
            previewHTML = `<div class="audio-preview">🎵</div>`;
            iconHTML = '▶';
            mediaTypeLabel = 'Audio';
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
            <div class="video-actions">
                <a href="${media.url}" target="_blank" class="btn-action btn-download" download="${displayName}">Download</a>
                <button class="btn-action btn-delete" data-path="${media.fullPath}">Delete</button>
            </div>
        `;

        // Delete handler
        const deleteBtn = mediaCard.querySelector('.btn-delete');
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete this ${mediaTypeLabel.toLowerCase()}?`)) {
                await deleteVideo(media.fullPath, mediaCard);
            }
        });

        videosGrid.appendChild(mediaCard);
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
