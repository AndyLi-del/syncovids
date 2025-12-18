import { auth, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, getDownloadURL, getMetadata } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

// Auth check
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loadVideo();
    } else {
        window.location.href = 'signin.html';
    }
});

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
        if (currentMediaType === 'video') {
            video.style.display = 'block';
            audio.style.display = 'none';
            image.style.display = 'none';
            videoSource.src = url;
            video.load();
            mediaPlayer = video;
            playerControls.style.display = 'block';
            setupMediaEventListeners();
        } else if (currentMediaType === 'audio') {
            video.style.display = 'none';
            audio.style.display = 'block';
            image.style.display = 'none';
            audioSource.src = url;
            audio.load();
            mediaPlayer = audio;
            playerControls.style.display = 'block';
            setupMediaEventListeners();
            // Show audio visualization
            videoWrapper.style.backgroundColor = '#1a1a1a';
        } else if (currentMediaType === 'image') {
            video.style.display = 'none';
            audio.style.display = 'none';
            image.style.display = 'block';
            image.src = url;
            mediaPlayer = null;
            // Hide playback controls for images
            playerControls.style.display = 'none';
            bigPlayBtn.style.display = 'none';
        }

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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
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
