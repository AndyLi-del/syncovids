import { db, auth, storage } from "./firebase-config.js";
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const messagesBtn = document.getElementById('messages-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');
const userUsername = document.getElementById('user-username');
const userEmail = document.getElementById('user-email');
const userUid = document.getElementById('user-uid');

// Upload elements
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const fileName = document.getElementById('file-name');
const uploadBtn = document.getElementById('upload-btn');
const uploadProgress = document.getElementById('upload-progress');
const progressBar = document.getElementById('progress-bar');
const uploadMessage = document.getElementById('upload-message');

// Profile picture elements
const profilePicture = document.getElementById('profile-picture');
const profilePictureOverlay = document.getElementById('profile-picture-overlay');
const profileInput = document.getElementById('profile-input');

let selectedFile = null;
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
        // User is signed in
        signinBtn.style.display = 'none';
        exploreBtn.style.display = 'inline-block';
        messagesBtn.style.display = 'inline-block';
        videosBtn.style.display = 'inline-block';
        dashboardBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';

        // Display user info
        userEmail.textContent = user.email;
        userUid.textContent = user.uid;

        // Ensure user exists in Firestore
        await syncUserToFirestore(user);

        // Get user data from Firestore
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                userUsername.textContent = userData.username;

                // Load profile picture
                if (userData.profilePicture) {
                    profilePicture.src = userData.profilePicture;
                } else {
                    profilePicture.src = defaultProfilePic;
                }
            } else {
                userUsername.textContent = user.displayName || 'N/A';
                profilePicture.src = defaultProfilePic;
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            userUsername.textContent = user.displayName || 'N/A';
            profilePicture.src = defaultProfilePic;
        }
    } else {
        // User is not signed in, redirect to signin
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

// File upload functionality
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// Drag and drop support
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    uploadBtn.disabled = false;
    uploadMessage.textContent = '';
    uploadMessage.className = 'upload-message';
}

uploadBtn.addEventListener('click', async () => {
    if (!selectedFile || !currentUser) return;

    uploadBtn.disabled = true;
    uploadProgress.style.display = 'block';
    uploadMessage.textContent = '';

    // Create a unique file path: users/{uid}/files/{timestamp}_{filename}
    const timestamp = Date.now();
    const filePath = `users/${currentUser.uid}/files/${timestamp}_${selectedFile.name}`;
    const storageRef = ref(storage, filePath);

    // Upload with progress tracking
    const uploadTask = uploadBytesResumable(storageRef, selectedFile);

    uploadTask.on('state_changed',
        (snapshot) => {
            // Progress
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            progressBar.style.width = progress + '%';
        },
        (error) => {
            // Error
            console.error('Upload error:', error);
            uploadMessage.textContent = 'Upload failed: ' + error.message;
            uploadMessage.className = 'upload-message error';
            uploadBtn.disabled = false;
            uploadProgress.style.display = 'none';
            progressBar.style.width = '0%';
        },
        async () => {
            // Success
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                uploadMessage.textContent = 'Upload successful!';
                uploadMessage.className = 'upload-message success';
                console.log('File available at:', downloadURL);
            } catch (error) {
                uploadMessage.textContent = 'Upload complete!';
                uploadMessage.className = 'upload-message success';
            }

            // Reset
            selectedFile = null;
            fileInput.value = '';
            fileName.textContent = '';
            uploadBtn.disabled = true;
            setTimeout(() => {
                uploadProgress.style.display = 'none';
                progressBar.style.width = '0%';
            }, 1000);
        }
    );
});

// Profile picture upload
profilePicture.parentElement.addEventListener('click', () => {
    profileInput.click();
});

profileInput.addEventListener('change', async (e) => {
    if (!e.target.files.length || !currentUser) return;

    const file = e.target.files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image must be less than 5MB');
        return;
    }

    profilePictureOverlay.querySelector('span').textContent = 'Uploading...';

    try {
        // Upload to storage
        const filePath = `users/${currentUser.uid}/profile/profile_picture`;
        const storageRef = ref(storage, filePath);
        const uploadTask = await uploadBytesResumable(storageRef, file);
        const downloadURL = await getDownloadURL(uploadTask.ref);

        // Update Firestore
        await updateDoc(doc(db, "users", currentUser.uid), {
            profilePicture: downloadURL
        });

        // Update UI
        profilePicture.src = downloadURL;
        profilePictureOverlay.querySelector('span').textContent = 'Change';

    } catch (error) {
        console.error('Error uploading profile picture:', error);
        alert('Failed to upload profile picture');
        profilePictureOverlay.querySelector('span').textContent = 'Change';
    }

    profileInput.value = '';
});
