import { db, auth } from "./firebase-config.js";
import { collection, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const form = document.getElementById('auth-form');
const message = document.getElementById('message');
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const usernameGroup = document.getElementById('username-group');
const usernameInput = document.getElementById('username');
const submitBtn = document.getElementById('submit-btn');
const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');

let isLoginMode = true;

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is already signed in, redirect to dashboard
        window.location.href = 'dashboard.html';
    } else {
        signinBtn.style.display = 'inline-block';
        exploreBtn.style.display = 'none';
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

// Toggle between login and signup
loginTab.addEventListener('click', () => {
    isLoginMode = true;
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    usernameGroup.style.display = 'none';
    usernameInput.required = false;
    submitBtn.textContent = 'Login';
    message.textContent = '';
});

signupTab.addEventListener('click', () => {
    isLoginMode = false;
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    usernameGroup.style.display = 'block';
    usernameInput.required = true;
    submitBtn.textContent = 'Sign Up';
    message.textContent = '';
});

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Basic validation
    if (password.length < 6) {
        message.textContent = 'Password must be at least 6 characters';
        message.className = 'error';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = isLoginMode ? 'Logging in...' : 'Signing up...';

    try {
        if (isLoginMode) {
            // Secure login with Firebase Auth
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            message.textContent = 'Login successful!';
            message.className = 'success';
            form.reset();

            // Redirect to dashboard after successful login
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            // Secure sign up with Firebase Auth
            const username = document.getElementById('username').value.trim();

            if (username.length < 3) {
                message.textContent = 'Username must be at least 3 characters';
                message.className = 'error';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign Up';
                return;
            }

            // Create user with Firebase Auth (password is automatically hashed)
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Update display name
            await updateProfile(user, {
                displayName: username
            });

            // Store additional user data in Firestore (no password stored)
            await setDoc(doc(db, "users", user.uid), {
                username: username,
                email: email,
                createdAt: new Date().toISOString(),
                uid: user.uid
            });

            message.textContent = 'Account created successfully!';
            message.className = 'success';
            form.reset();

            // Redirect to dashboard after successful signup
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    } catch (error) {
        // Handle specific Firebase Auth errors
        let errorMessage = 'An error occurred';

        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email is already registered';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many attempts. Please try again later';
                break;
            default:
                errorMessage = error.message;
        }

        message.textContent = errorMessage;
        message.className = 'error';
        console.error('Auth error:', error.code, error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
    }
});
