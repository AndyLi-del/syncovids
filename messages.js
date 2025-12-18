import { db, auth } from "./firebase-config.js";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    getDocs,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// DOM Elements
const signinBtn = document.getElementById('signin-btn');
const exploreBtn = document.getElementById('explore-btn');
const messagesBtn = document.getElementById('messages-btn');
const videosBtn = document.getElementById('videos-btn');
const dashboardBtn = document.getElementById('dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');
const conversationsList = document.getElementById('conversations-list');
const loading = document.getElementById('loading');
const noConversations = document.getElementById('no-conversations');
const chatPlaceholder = document.getElementById('chat-placeholder');
const chatContent = document.getElementById('chat-content');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatUsername = document.getElementById('chat-username');
const chatAvatar = document.getElementById('chat-avatar');
const chatUserLink = document.getElementById('chat-user-link');

let currentUser = null;
let currentChatUserId = null;
let messagesUnsubscribe = null;
let conversationsUnsubscribe = null;

// Default profile picture
const defaultProfilePic = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMzMzMiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIyMCIgZmlsbD0iIzY2NiIvPjxlbGxpcHNlIGN4PSI1MCIgY3k9Ijk1IiByeD0iMzUiIHJ5PSIzMCIgZmlsbD0iIzY2NiIvPjwvc3ZnPg==';

// Generate a consistent conversation ID for two users
function getConversationId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
}

// Sync signed-in user to Firestore
async function syncUserToFirestore(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const existing = await getDoc(userRef);

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
        messagesBtn.style.display = 'inline-block';
        videosBtn.style.display = 'inline-block';
        dashboardBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'inline-block';

        await syncUserToFirestore(user);

        // Check for uid param to open specific conversation
        const params = new URLSearchParams(window.location.search);
        const targetUserId = params.get('uid');

        loadConversations();

        if (targetUserId && targetUserId !== currentUser.uid) {
            // Small delay to ensure conversations are loading
            setTimeout(() => openChat(targetUserId), 500);
        }
    } else {
        window.location.href = 'signin.html';
    }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
    try {
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (conversationsUnsubscribe) conversationsUnsubscribe();
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

// Load all conversations for current user
function loadConversations() {
    const conversationsRef = collection(db, "conversations");
    const q = query(
        conversationsRef,
        where("participants", "array-contains", currentUser.uid),
        orderBy("lastMessageTime", "desc")
    );

    conversationsUnsubscribe = onSnapshot(q, async (snapshot) => {
        loading.style.display = 'none';

        if (snapshot.empty) {
            noConversations.style.display = 'block';
            conversationsList.innerHTML = '';
            return;
        }

        noConversations.style.display = 'none';

        const conversations = [];
        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const otherUserId = data.participants.find(id => id !== currentUser.uid);

            // Get other user's info
            const userDoc = await getDoc(doc(db, "users", otherUserId));
            const userData = userDoc.exists() ? userDoc.data() : { username: 'Unknown User' };

            conversations.push({
                id: docSnap.id,
                otherUserId,
                otherUsername: userData.username,
                otherProfilePic: userData.profilePicture || defaultProfilePic,
                lastMessage: data.lastMessage || '',
                lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
                unreadCount: data.unreadCount?.[currentUser.uid] || 0
            });
        }

        renderConversations(conversations);
    }, (error) => {
        console.error('Error loading conversations:', error);
        loading.style.display = 'none';
        noConversations.textContent = 'Error loading conversations. Please try again.';
        noConversations.style.display = 'block';
    });
}

// Render conversations list
function renderConversations(conversations) {
    conversationsList.innerHTML = '';

    conversations.forEach(conv => {
        const convEl = document.createElement('div');
        convEl.className = `conversation-item${conv.otherUserId === currentChatUserId ? ' active' : ''}`;
        convEl.dataset.userId = conv.otherUserId;

        const timeStr = formatMessageTime(conv.lastMessageTime);
        const unreadBadge = conv.unreadCount > 0
            ? `<span class="unread-badge">${conv.unreadCount}</span>`
            : '';

        convEl.innerHTML = `
            <img src="${conv.otherProfilePic}" alt="${conv.otherUsername}" class="conversation-avatar">
            <div class="conversation-info">
                <div class="conversation-header">
                    <span class="conversation-name">${conv.otherUsername}</span>
                    <span class="conversation-time">${timeStr}</span>
                </div>
                <div class="conversation-preview">
                    <span class="preview-text">${truncateText(conv.lastMessage, 40)}</span>
                    ${unreadBadge}
                </div>
            </div>
        `;

        convEl.addEventListener('click', () => openChat(conv.otherUserId));
        conversationsList.appendChild(convEl);
    });
}

// Open chat with a specific user
async function openChat(userId) {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }

    currentChatUserId = userId;

    // Update active state in list
    document.querySelectorAll('.conversation-item').forEach(el => {
        el.classList.toggle('active', el.dataset.userId === userId);
    });

    // Get user info
    const userDoc = await getDoc(doc(db, "users", userId));
    const userData = userDoc.exists() ? userDoc.data() : { username: 'Unknown User' };

    // Update chat header
    chatUsername.textContent = userData.username;
    chatAvatar.src = userData.profilePicture || defaultProfilePic;
    chatUserLink.href = `profile.html?uid=${userId}`;

    // Show chat content
    chatPlaceholder.style.display = 'none';
    chatContent.style.display = 'flex';

    // Clear unread count
    const conversationId = getConversationId(currentUser.uid, userId);
    const convRef = doc(db, "conversations", conversationId);
    const convDoc = await getDoc(convRef);
    if (convDoc.exists()) {
        const unreadUpdate = {};
        unreadUpdate[`unreadCount.${currentUser.uid}`] = 0;
        await updateDoc(convRef, unreadUpdate);
    }

    // Load messages
    loadMessages(userId);

    // Focus input
    chatInput.focus();
}

// Load messages for a conversation
function loadMessages(otherUserId) {
    const conversationId = getConversationId(currentUser.uid, otherUserId);
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        chatMessages.innerHTML = '';

        if (snapshot.empty) {
            chatMessages.innerHTML = '<p class="no-messages">No messages yet. Say hello!</p>';
            return;
        }

        snapshot.docs.forEach(docSnap => {
            const msg = docSnap.data();
            renderMessage(msg);
        });

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, (error) => {
        console.error('Error loading messages:', error);
        chatMessages.innerHTML = '<p class="error-message">Error loading messages.</p>';
    });
}

// Render a single message
function renderMessage(message) {
    const msgEl = document.createElement('div');
    const isOwn = message.senderId === currentUser.uid;
    msgEl.className = `message ${isOwn ? 'message-own' : 'message-other'}`;

    const time = message.timestamp?.toDate()
        ? formatMessageTime(message.timestamp.toDate())
        : '';

    msgEl.innerHTML = `
        <div class="message-bubble">
            <p class="message-text">${escapeHtml(message.text)}</p>
            <span class="message-time">${time}</span>
        </div>
    `;

    chatMessages.appendChild(msgEl);
}

// Send a message
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text || !currentChatUserId) return;

    chatInput.value = '';
    chatInput.disabled = true;

    try {
        const conversationId = getConversationId(currentUser.uid, currentChatUserId);
        const convRef = doc(db, "conversations", conversationId);
        const messagesRef = collection(db, "conversations", conversationId, "messages");

        // Add message
        await addDoc(messagesRef, {
            senderId: currentUser.uid,
            text: text,
            timestamp: serverTimestamp()
        });

        // Update or create conversation document
        const convDoc = await getDoc(convRef);
        const unreadCount = convDoc.exists() ? (convDoc.data().unreadCount || {}) : {};
        unreadCount[currentChatUserId] = (unreadCount[currentChatUserId] || 0) + 1;
        unreadCount[currentUser.uid] = 0;

        await setDoc(convRef, {
            participants: [currentUser.uid, currentChatUserId],
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            unreadCount: unreadCount
        }, { merge: true });

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        chatInput.disabled = false;
        chatInput.focus();
    }
});

// Helper: Format message time
function formatMessageTime(date) {
    const now = new Date();
    const diff = now - date;
    const dayInMs = 24 * 60 * 60 * 1000;

    if (diff < dayInMs && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diff < 7 * dayInMs) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

// Helper: Truncate text
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Helper: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
