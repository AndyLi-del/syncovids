import { auth, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, getDownloadURL, getMetadata } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Elements
const playerContainer = document.getElementById('player-container');
const videoWrapper = document.getElementById('video-wrapper');
const video = document.getElementById('video-player');
const videoSource = document.getElementById('video-source');
const videoTitle = document.getElementById('video-title');
const videoMeta = document.getElementById('video-meta');

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
    const videoPath = params.get('path');

    if (!videoPath) {
        videoTitle.textContent = 'No video specified';
        return;
    }

    try {
        const videoRef = ref(storage, videoPath);
        const url = await getDownloadURL(videoRef);
        const metadata = await getMetadata(videoRef);

        // Extract display name
        const fileName = videoPath.split('/').pop();
        const displayName = fileName.replace(/^\d+_/, '');

        videoTitle.textContent = displayName;
        document.title = `${displayName} - Syncovids`;

        // Set video source
        videoSource.src = url;
        video.load();

        // Display meta info
        const uploadDate = new Date(metadata.timeCreated).toLocaleDateString();
        const fileSize = formatFileSize(metadata.size);
        videoMeta.textContent = `Uploaded: ${uploadDate} • Size: ${fileSize}`;

    } catch (error) {
        console.error('Error loading video:', error);
        videoTitle.textContent = 'Error loading video';
    }
}

// Play/Pause
function togglePlay() {
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

playPauseBtn.addEventListener('click', togglePlay);
bigPlayBtn.addEventListener('click', togglePlay);
video.addEventListener('click', togglePlay);

video.addEventListener('play', () => {
    playPauseBtn.textContent = '⏸';
    bigPlayBtn.style.display = 'none';
});

video.addEventListener('pause', () => {
    playPauseBtn.textContent = '▶';
    bigPlayBtn.style.display = 'flex';
});

video.addEventListener('ended', () => {
    playPauseBtn.textContent = '▶';
    bigPlayBtn.style.display = 'flex';
});

// Rewind/Forward (10 seconds)
rewindBtn.addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
});

forwardBtn.addEventListener('click', () => {
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
});

// Volume
muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    updateVolumeIcon();
});

volumeSlider.addEventListener('input', (e) => {
    video.volume = e.target.value;
    video.muted = false;
    updateVolumeIcon();
});

function updateVolumeIcon() {
    if (video.muted || video.volume === 0) {
        muteBtn.textContent = '🔇';
    } else if (video.volume < 0.5) {
        muteBtn.textContent = '🔉';
    } else {
        muteBtn.textContent = '🔊';
    }
    volumeSlider.value = video.muted ? 0 : video.volume;
}

// Time display
video.addEventListener('loadedmetadata', () => {
    durationEl.textContent = formatTime(video.duration);
});

video.addEventListener('timeupdate', () => {
    currentTimeEl.textContent = formatTime(video.currentTime);
    const percent = (video.currentTime / video.duration) * 100;
    progressPlayed.style.width = `${percent}%`;
});

// Buffered progress
video.addEventListener('progress', () => {
    if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1);
        const percent = (buffered / video.duration) * 100;
        progressBuffered.style.width = `${percent}%`;
    }
});

// Progress bar click
progressContainer.addEventListener('click', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = percent * video.duration;
});

// Playback speed
speedSelect.addEventListener('change', (e) => {
    video.playbackRate = parseFloat(e.target.value);
});

// Picture in Picture
pipBtn.addEventListener('click', async () => {
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
    playerControls.classList.add('visible');
    videoWrapper.style.cursor = 'default';
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(hideControls, 3000);
}

function hideControls() {
    if (!video.paused) {
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
            video.muted = !video.muted;
            updateVolumeIcon();
            break;
        case 'arrowleft':
            e.preventDefault();
            video.currentTime -= 5;
            break;
        case 'arrowright':
            e.preventDefault();
            video.currentTime += 5;
            break;
        case 'arrowup':
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            updateVolumeIcon();
            break;
        case 'arrowdown':
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            updateVolumeIcon();
            break;
        case 'j':
            e.preventDefault();
            video.currentTime -= 10;
            break;
        case 'l':
            e.preventDefault();
            video.currentTime += 10;
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
            video.currentTime = (parseInt(e.key) / 10) * video.duration;
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
