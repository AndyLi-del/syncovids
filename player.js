import { auth, storage, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, getDownloadURL, getMetadata } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc, getDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Elements
const playerContainer = document.getElementById('player-container');
const videoWrapper = document.getElementById('video-wrapper');
const video = document.getElementById('video-player');
const videoSource = document.getElementById('video-source');
const audio = document.getElementById('audio-player');
const audioSource = document.getElementById('audio-source');
const image = document.getElementById('image-viewer');
const videoTitle = document.getElementById('video-title');
const videoMeta = document.getElementById('video-meta');

// Media type tracking
let currentMediaType = null;
let mediaPlayer = null; // Will be video or audio element

// Controls
const playPauseBtn = document.getElementById('play-pause-btn');
const rewindBtn = document.getElementById('rewind-btn');
const forwardBtn = document.getElementById('forward-btn');
const muteBtn = document.getElementById('mute-btn');
const volumeSlider = document.getElementById('volume-slider');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const progressContainer = document.getElementById('progress-container');
const progressPlayed = document.getElementById('progress-played');
const progressBuffered = document.getElementById('progress-buffered');
const speedSelect = document.getElementById('speed-select');
const pipBtn = document.getElementById('pip-btn');
const theaterBtn = document.getElementById('theater-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const fullscreenControlBtn = document.getElementById('fullscreen-control-btn');
const bigPlayBtn = document.getElementById('big-play-btn');
const playerControls = document.getElementById('player-controls');

let controlsTimeout;
let isTheaterMode = false;

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

// Media player initialization helpers
function hideAllMediaElements() {
    video.style.display = 'none';
    audio.style.display = 'none';
    image.style.display = 'none';
}

function initializePlaybackMedia(element, sourceElement, url) {
    element.style.display = 'block';
    sourceElement.src = url;
    element.load();
    mediaPlayer = element;
    playerControls.style.display = 'block';
    setupMediaEventListeners();
}

function initializeImageDisplay(url) {
    image.style.display = 'block';
    image.src = url;
    mediaPlayer = null;
    playerControls.style.display = 'none';
    bigPlayBtn.style.display = 'none';
}

function initializeMediaPlayer(url) {
    hideAllMediaElements();

    switch (currentMediaType) {
        case 'video':
            initializePlaybackMedia(video, videoSource, url);
            break;
        case 'audio':
            initializePlaybackMedia(audio, audioSource, url);
            videoWrapper.style.backgroundColor = '#1a1a1a';
            break;
        case 'image':
            initializeImageDisplay(url);
            break;
    }
}

// Auth check is handled at the bottom of the file with comments integration

// Load video from URL params
async function loadVideo() {
    const params = new URLSearchParams(window.location.search);
    const mediaPath = params.get('path');

    if (!mediaPath) {
        videoTitle.textContent = 'No media specified';
        return;
    }

    try {
        const mediaRef = ref(storage, mediaPath);
        const url = await getDownloadURL(mediaRef);
        const metadata = await getMetadata(mediaRef);

        // Extract display name
        const fileName = mediaPath.split('/').pop();
        const displayName = fileName.replace(/^\d+_/, '');

        videoTitle.textContent = displayName;
        document.title = `${displayName} - Syncovids`;

        // Determine media type
        currentMediaType = getMediaType(fileName);

        // Display meta info
        const uploadDate = new Date(metadata.timeCreated).toLocaleDateString();
        const fileSize = formatFileSize(metadata.size);
        videoMeta.textContent = `Uploaded: ${uploadDate} • Size: ${fileSize}`;

        // Show appropriate player based on media type
        initializeMediaPlayer(url);

    } catch (error) {
        console.error('Error loading media:', error);
        videoTitle.textContent = 'Error loading media';
    }
}

// Setup event listeners for media player (video or audio)
function setupMediaEventListeners() {
    if (!mediaPlayer) return;

    mediaPlayer.addEventListener('play', () => {
        playPauseBtn.textContent = '⏸';
        bigPlayBtn.style.display = 'none';
    });

    mediaPlayer.addEventListener('pause', () => {
        playPauseBtn.textContent = '▶';
        bigPlayBtn.style.display = 'flex';
    });

    mediaPlayer.addEventListener('ended', () => {
        playPauseBtn.textContent = '▶';
        bigPlayBtn.style.display = 'flex';
    });

    mediaPlayer.addEventListener('loadedmetadata', () => {
        durationEl.textContent = formatTime(mediaPlayer.duration);
    });

    mediaPlayer.addEventListener('timeupdate', () => {
        currentTimeEl.textContent = formatTime(mediaPlayer.currentTime);
        const percent = (mediaPlayer.currentTime / mediaPlayer.duration) * 100;
        progressPlayed.style.width = `${percent}%`;
    });

    mediaPlayer.addEventListener('progress', () => {
        if (mediaPlayer.buffered.length > 0) {
            const buffered = mediaPlayer.buffered.end(mediaPlayer.buffered.length - 1);
            const percent = (buffered / mediaPlayer.duration) * 100;
            progressBuffered.style.width = `${percent}%`;
        }
    });
}

// Play/Pause
function togglePlay() {
    if (!mediaPlayer) return;
    if (mediaPlayer.paused) {
        mediaPlayer.play();
    } else {
        mediaPlayer.pause();
    }
}

playPauseBtn.addEventListener('click', togglePlay);
bigPlayBtn.addEventListener('click', togglePlay);
video.addEventListener('click', togglePlay);
audio.addEventListener('click', togglePlay);

// Rewind/Forward (10 seconds)
rewindBtn.addEventListener('click', () => {
    if (mediaPlayer) {
        mediaPlayer.currentTime = Math.max(0, mediaPlayer.currentTime - 10);
    }
});

forwardBtn.addEventListener('click', () => {
    if (mediaPlayer) {
        mediaPlayer.currentTime = Math.min(mediaPlayer.duration, mediaPlayer.currentTime + 10);
    }
});

// Volume
muteBtn.addEventListener('click', () => {
    if (mediaPlayer) {
        mediaPlayer.muted = !mediaPlayer.muted;
        updateVolumeIcon();
    }
});

volumeSlider.addEventListener('input', (e) => {
    if (mediaPlayer) {
        mediaPlayer.volume = e.target.value;
        mediaPlayer.muted = false;
        updateVolumeIcon();
    }
});

function updateVolumeIcon() {
    if (!mediaPlayer) return;
    if (mediaPlayer.muted || mediaPlayer.volume === 0) {
        muteBtn.textContent = '🔇';
    } else if (mediaPlayer.volume < 0.5) {
        muteBtn.textContent = '🔉';
    } else {
        muteBtn.textContent = '🔊';
    }
    volumeSlider.value = mediaPlayer.muted ? 0 : mediaPlayer.volume;
}

// Progress bar click
progressContainer.addEventListener('click', (e) => {
    if (mediaPlayer) {
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        mediaPlayer.currentTime = percent * mediaPlayer.duration;
    }
});

// Playback speed
speedSelect.addEventListener('change', (e) => {
    if (mediaPlayer) {
        mediaPlayer.playbackRate = parseFloat(e.target.value);
    }
});

// Picture in Picture (only for video)
pipBtn.addEventListener('click', async () => {
    if (currentMediaType !== 'video') return;
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            await video.requestPictureInPicture();
        }
    } catch (error) {
        console.error('PiP error:', error);
    }
});

// Theater Mode
theaterBtn.addEventListener('click', () => {
    isTheaterMode = !isTheaterMode;
    playerContainer.classList.toggle('theater-mode', isTheaterMode);
    theaterBtn.textContent = isTheaterMode ? '🖼' : '🎬';
});

// Fullscreen
function toggleFullscreen() {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        videoWrapper.requestFullscreen();
    }
}

fullscreenBtn.addEventListener('click', toggleFullscreen);
fullscreenControlBtn.addEventListener('click', toggleFullscreen);

document.addEventListener('fullscreenchange', () => {
    const isFullscreen = !!document.fullscreenElement;
    fullscreenBtn.textContent = isFullscreen ? '⛶' : '⛶';
    fullscreenControlBtn.textContent = isFullscreen ? '⛶' : '⛶';
    videoWrapper.classList.toggle('fullscreen', isFullscreen);
});

// Double click for fullscreen
video.addEventListener('dblclick', toggleFullscreen);

// Show/hide controls on mouse move
videoWrapper.addEventListener('mousemove', showControls);
videoWrapper.addEventListener('mouseleave', hideControlsDelayed);

function showControls() {
    if (currentMediaType !== 'image') {
        playerControls.classList.add('visible');
        videoWrapper.style.cursor = 'default';
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(hideControls, 3000);
    }
}

function hideControls() {
    if (mediaPlayer && !mediaPlayer.paused && currentMediaType !== 'image') {
        playerControls.classList.remove('visible');
        videoWrapper.style.cursor = 'none';
    }
}

function hideControlsDelayed() {
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(hideControls, 1000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (currentMediaType === 'image') return; // No keyboard shortcuts for images

    switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
            e.preventDefault();
            togglePlay();
            break;
        case 'f':
            e.preventDefault();
            toggleFullscreen();
            break;
        case 'm':
            e.preventDefault();
            if (mediaPlayer) {
                mediaPlayer.muted = !mediaPlayer.muted;
                updateVolumeIcon();
            }
            break;
        case 'arrowleft':
            e.preventDefault();
            if (mediaPlayer) mediaPlayer.currentTime -= 5;
            break;
        case 'arrowright':
            e.preventDefault();
            if (mediaPlayer) mediaPlayer.currentTime += 5;
            break;
        case 'arrowup':
            e.preventDefault();
            if (mediaPlayer) {
                mediaPlayer.volume = Math.min(1, mediaPlayer.volume + 0.1);
                updateVolumeIcon();
            }
            break;
        case 'arrowdown':
            e.preventDefault();
            if (mediaPlayer) {
                mediaPlayer.volume = Math.max(0, mediaPlayer.volume - 0.1);
                updateVolumeIcon();
            }
            break;
        case 'j':
            e.preventDefault();
            if (mediaPlayer) mediaPlayer.currentTime -= 10;
            break;
        case 'l':
            e.preventDefault();
            if (mediaPlayer) mediaPlayer.currentTime += 10;
            break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
            e.preventDefault();
            if (mediaPlayer) mediaPlayer.currentTime = (parseInt(e.key) / 10) * mediaPlayer.duration;
            break;
    }
    showControls();
});

// Helper functions
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ==================== COMMENTS SECTION ====================

// Comment Elements
const commentInput = document.getElementById('comment-input');
const btnSubmitComment = document.getElementById('btn-submit-comment');
const btnCancelComment = document.getElementById('btn-cancel-comment');
const commentsList = document.getElementById('comments-list');
const commentsLoading = document.getElementById('comments-loading');
const commentsCount = document.getElementById('comments-count');
const currentUserAvatar = document.getElementById('current-user-avatar');

// Current user info
let currentUser = null;
let currentUserData = null;
let currentFilePath = null;
let unsubscribeComments = null;

// Generate a unique file ID from the path (for Firestore querying)
function getFileId(path) {
    // Use a hash-like approach: encode the path to create a valid document ID
    return btoa(path).replace(/[/+=]/g, '_');
}

// Load current user data
async function loadCurrentUserData(user) {
    currentUser = user;
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            // Set current user avatar
            if (currentUserData.profilePicture) {
                currentUserAvatar.src = currentUserData.profilePicture;
            } else {
                currentUserAvatar.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23333"/><circle cx="50" cy="35" r="20" fill="%23666"/><ellipse cx="50" cy="85" rx="35" ry="30" fill="%23666"/></svg>';
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load comments for the current file
function loadComments(filePath) {
    currentFilePath = filePath;
    const fileId = getFileId(filePath);

    // Unsubscribe from previous listener if exists
    if (unsubscribeComments) {
        unsubscribeComments();
    }

    const commentsRef = collection(db, 'comments');
    // Simple query without orderBy to avoid composite index requirement
    const q = query(commentsRef, where('fileId', '==', fileId));

    unsubscribeComments = onSnapshot(q, (snapshot) => {
        commentsLoading.style.display = 'none';
        commentsCount.textContent = `(${snapshot.size})`;

        // Clear existing comments (except loading)
        const existingComments = commentsList.querySelectorAll('.comment-item');
        existingComments.forEach(c => c.remove());

        // Remove "no comments" message if exists
        const noCommentsEl = commentsList.querySelector('.no-comments');
        if (noCommentsEl) noCommentsEl.remove();

        if (snapshot.empty) {
            const noComments = document.createElement('div');
            noComments.className = 'no-comments';
            noComments.textContent = 'No comments yet. Be the first to comment!';
            commentsList.appendChild(noComments);
            return;
        }

        // Sort comments by createdAt client-side (newest first)
        const comments = [];
        snapshot.forEach((docSnap) => {
            comments.push({ id: docSnap.id, ...docSnap.data() });
        });

        comments.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return timeB - timeA; // Newest first
        });

        comments.forEach((comment) => {
            const commentEl = createCommentElement(comment.id, comment);
            commentsList.appendChild(commentEl);
        });
    }, (error) => {
        console.error('Error loading comments:', error);
        commentsLoading.style.display = 'none';

        // Check if it's a permission error
        if (error.code === 'permission-denied') {
            commentsLoading.textContent = 'Unable to load comments. Please sign in.';
        } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'no-comments';
            errorDiv.textContent = 'Unable to load comments. Please try again.';
            commentsList.appendChild(errorDiv);
        }
    });
}

// Create a comment element
function createCommentElement(commentId, comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    div.dataset.commentId = commentId;

    const avatar = comment.userProfilePicture || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23333"/><circle cx="50" cy="35" r="20" fill="%23666"/><ellipse cx="50" cy="85" rx="35" ry="30" fill="%23666"/></svg>';

    const timeAgo = formatTimeAgo(comment.createdAt?.toDate ? comment.createdAt.toDate() : new Date(comment.createdAt));

    const isOwner = currentUser && comment.userId === currentUser.uid;

    div.innerHTML = `
        <img class="comment-avatar" src="${avatar}" alt="${comment.username}'s avatar">
        <div class="comment-content">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(comment.username)}</span>
                <span class="comment-time">${timeAgo}</span>
                ${isOwner ? `<button class="btn-delete-comment" data-id="${commentId}" title="Delete comment">Delete</button>` : ''}
            </div>
            <p class="comment-text">${escapeHtml(comment.text)}</p>
        </div>
    `;

    // Add delete handler if owner
    if (isOwner) {
        const deleteBtn = div.querySelector('.btn-delete-comment');
        deleteBtn.addEventListener('click', () => deleteComment(commentId));
    }

    return div;
}

// Submit a new comment
async function submitComment() {
    const text = commentInput.value.trim();
    if (!text || !currentUser || !currentFilePath) {
        console.log('Submit blocked:', { text: !!text, currentUser: !!currentUser, currentFilePath: !!currentFilePath });
        return;
    }

    btnSubmitComment.disabled = true;
    btnSubmitComment.textContent = 'Posting...';

    try {
        const fileId = getFileId(currentFilePath);
        const commentData = {
            fileId: fileId,
            filePath: currentFilePath,
            userId: currentUser.uid,
            username: currentUserData?.username || currentUser.displayName || 'Anonymous',
            userProfilePicture: currentUserData?.profilePicture || null,
            text: text,
            createdAt: serverTimestamp()
        };

        console.log('Submitting comment:', commentData);
        await addDoc(collection(db, 'comments'), commentData);
        console.log('Comment submitted successfully');

        commentInput.value = '';
        commentInput.style.height = 'auto';
        btnSubmitComment.textContent = 'Comment';
        btnCancelComment.click(); // Reset form state
    } catch (error) {
        console.error('Error posting comment:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);

        if (error.code === 'permission-denied') {
            alert('Permission denied. Please make sure you are signed in.');
        } else {
            alert('Failed to post comment: ' + error.message);
        }
        btnSubmitComment.disabled = false;
        btnSubmitComment.textContent = 'Comment';
    }
}

// Delete a comment
async function deleteComment(commentId) {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
        await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
        console.error('Error deleting comment:', error);
        alert('Failed to delete comment. Please try again.');
    }
}

// Format time ago
function formatTimeAgo(date) {
    if (!date) return 'Just now';

    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 0 || isNaN(seconds)) return 'Just now';
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

    return date.toLocaleDateString();
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Comment form event listeners
commentInput.addEventListener('input', () => {
    btnSubmitComment.disabled = commentInput.value.trim().length === 0;

    // Auto-resize textarea
    commentInput.style.height = 'auto';
    commentInput.style.height = commentInput.scrollHeight + 'px';
});

commentInput.addEventListener('focus', () => {
    document.querySelector('.comment-actions').style.display = 'flex';
});

btnCancelComment.addEventListener('click', () => {
    commentInput.value = '';
    commentInput.style.height = 'auto';
    btnSubmitComment.disabled = true;
    document.querySelector('.comment-actions').style.display = 'none';
    commentInput.blur();
});

btnSubmitComment.addEventListener('click', submitComment);

// Allow Ctrl+Enter to submit
commentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (!btnSubmitComment.disabled) {
            submitComment();
        }
    }
});

// Initialize comments when media loads
const originalLoadVideo = loadVideo;
async function loadVideoWithComments() {
    await originalLoadVideo.call(this);

    // Get file path from URL params
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('path');

    if (filePath && currentUser) {
        loadComments(filePath);
    }
}

// Override auth state handler to load user data and comments
const originalOnAuthStateChanged = onAuthStateChanged;
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadCurrentUserData(user);
        loadVideoWithComments();
    } else {
        window.location.href = 'signin.html';
    }
});
