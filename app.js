// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { 
  getDatabase, ref, push, update, onValue, onChildAdded, onChildChanged, set, off, get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Firebase Config (keep your config)
const firebaseConfig = {
  apiKey: "AIzaSyCWW-WrrnsHsywUOvFs4UL0y2Q8se81rvg",
  authDomain: "chatapp-1754e.firebaseapp.com",
  databaseURL: "https://chatapp-1754e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chatapp-1754e",
  storageBucket: "chatapp-1754e.firebasestorage.app",
  messagingSenderId: "40067617299",
  appId: "1:40067617299:web:7b23a059a1832cb7d765e6",
  measurementId: "G-LR82HTGTV1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Elements
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const userEmail = document.getElementById("user-email");
const authSection = document.getElementById("auth-section");
const chatSection = document.getElementById("chat-section");
const userListEl = document.getElementById("user-list");
const chattingWith = document.getElementById("chatting-with");
const privateMessages = document.getElementById("private-messages");
const privateInput = document.getElementById("private-input");
const privateSend = document.getElementById("private-send");
const groupMessages = document.getElementById("group-messages");
const groupInput = document.getElementById("group-input");
const groupSend = document.getElementById("group-send");
const fullnameInput = document.getElementById("fullname");
const typingIndicator = document.getElementById("typing-indicator");

let privateUser = null;

// --- Caches & listener refs (to avoid duplicates) ---
const usersCache = {}; // { uid: { email, fullName, online } }
let usersRef = ref(db, "users");
let groupRef = ref(db, "groupMessages");
let groupTypingRef = ref(db, "groupTyping");
let currentChatRef = null;
let currentPrivateTypingRef = null;
let groupChildAddedListener = null;
let groupChildChangedListener = null;

// ---------------- SIGNUP ----------------
signupBtn.addEventListener("click", async () => {
  try {
    const fullName = fullnameInput.value.trim();
    if (!fullName) {
      alert("Please enter your full name.");
      return;
    }
    const cred = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    await update(ref(db, "users/" + cred.user.uid), {
      email: cred.user.email,
      fullName: fullName,
      online: true,
      lastSeen: Date.now()
    });
    loadUsers(); // refresh cache
  } catch (err) {
    alert(err.message);
    console.error("Signup error:", err);
  }
});

// ---------------- LOGIN ----------------
loginBtn.addEventListener("click", async () => {
  try {
    const cred = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    await update(ref(db, "users/" + cred.user.uid), {
      email: cred.user.email,
      online: true,
      lastSeen: Date.now()
    });
    loadUsers();
  } catch (err) {
    alert(err.message);
    console.error("Login error:", err);
  }
});

// ---------------- LOGOUT ----------------
logoutBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (user) {
    await update(ref(db, "users/" + user.uid), { online: false, lastSeen: Date.now() });
  }
  signOut(auth);
});

// ---------------- AUTH STATE ----------------
onAuthStateChanged(auth, (user) => {
  cleanupAllListeners();
  if (user) {
    authSection.style.display = "none";
    chatSection.style.display = "block";

    const userRef = ref(db, "users/" + user.uid);
    // listen once for display name
    get(userRef).then(snapshot => {
      const userData = snapshot.val();
      if (userData && userData.fullName) userEmail.textContent = getFirstName(userData.fullName);
      else userEmail.textContent = user.email;
    }).catch(console.error);

    update(ref(db, "users/" + user.uid), {
      email: user.email,
      online: true,
      lastSeen: Date.now()
    }).then(() => {
      loadUsers();
    });

    attachGroupListeners();
    loadTypingIndicators();
  } else {
    authSection.style.display = "block";
    chatSection.style.display = "none";
    userListEl.innerHTML = "";
    privateMessages.innerHTML = "";
    groupMessages.innerHTML = "";
    typingIndicator.textContent = "";
  }
});

// ---------------- LOAD USERS (with cache & single listener) ----------------
function loadUsers() {
  // detach previous users listener to avoid duplication
  try { off(usersRef); } catch (e) {}

  // Keep cache up-to-date and render user list
  onValue(usersRef, (snapshot) => {
    usersCacheClearAndPopulate(snapshot);
    renderUserList();
  }, (error) => {
    console.error("Error loading users:", error);
    userListEl.innerHTML = "<li>Error loading users.</li>";
  });
}

function usersCacheClearAndPopulate(snapshot) {
  // clear cache
  for (const k in usersCache) delete usersCache[k];
  snapshot.forEach(child => {
    usersCache[child.key] = child.val();
  });
}

function renderUserList() {
  userListEl.innerHTML = "";
  const myUid = auth.currentUser?.uid;
  let foundOtherUsers = false;

  Object.keys(usersCache).forEach(uid => {
    const user = usersCache[uid];
    if (!user || !user.email || uid === myUid) return;
    foundOtherUsers = true;
    const li = document.createElement("li");
    li.textContent = `${getFirstName(user.fullName || user.email)} ${user.online ? "(online)" : "(offline)"}`;
    li.classList.add(user.online ? "online" : "offline");
    li.addEventListener("click", () => {
      privateUser = uid;
      chattingWith.textContent = getFirstName(user.fullName || user.email);
      privateMessages.innerHTML = "";
      loadPrivateChat(uid);
    });
    userListEl.appendChild(li);
  });

  if (!foundOtherUsers) {
    const li = document.createElement("li");
    li.textContent = "No other users found.";
    li.classList.add("offline");
    userListEl.appendChild(li);
  }
}

// ---------------- SEND GROUP MESSAGE ----------------
groupSend.addEventListener("click", async () => {
  const text = groupInput.value.trim();
  if (!text) return;
  const user = auth.currentUser;
  if (!user) return;

  const newMsgRef = push(ref(db, "groupMessages"));
  await update(newMsgRef, {
    senderUid: user.uid,
    sender: user.email,
    text: text,
    ts: Date.now()
  });
  groupInput.value = "";

  // mark typing false
  await update(ref(db, "groupTyping/" + user.uid), { [user.uid]: false }); // safe no overwrite
});

// ---------------- SEND PRIVATE MESSAGE ----------------
privateSend.addEventListener("click", async () => {
  const text = privateInput.value.trim();
  if (!text || !privateUser) return;
  const user = auth.currentUser;
  if (!user) return;

  const chatId = getChatId(user.uid, privateUser);
  const newRef = push(ref(db, "privateChats/" + chatId));
  await update(newRef, {
    senderUid: user.uid,
    sender: user.email,
    text: text,
    ts: Date.now(),
    read: false
  });
  privateInput.value = "";

  // mark typing false for private
  await update(ref(db, "privateTyping/" + chatId + "/" + user.uid), { [user.uid]: false });
});

// ---------------- GROUP CHAT (attach listeners safely) ----------------
function attachGroupListeners() {
  // detach previous group listeners (if any)
  try {
    if (groupChildAddedListener) off(groupRef, "child_added", groupChildAddedListener);
    if (groupChildChangedListener) off(groupRef, "child_changed", groupChildChangedListener);
  } catch (e) {}

  // child_added
  groupChildAddedListener = onChildAdded(groupRef, (snapshot) => {
    renderGroupMessage(snapshot.key, snapshot.val());
    groupMessages.scrollTop = groupMessages.scrollHeight;

    const msg = snapshot.val();
    // mark as read (merge)
    if (msg && msg.senderUid !== auth.currentUser.uid) {
      const readByRef = ref(db, `groupMessages/${snapshot.key}/readBy`);
      update(readByRef, { [auth.currentUser.uid]: true }).catch(console.error);
    }
  });

  // child_changed - to capture readBy updates
  groupChildChangedListener = onChildChanged(groupRef, (snapshot) => {
    const msgKey = snapshot.key;
    const msgData = snapshot.val();

    const wrapper = document.getElementById("msg-" + msgKey);
    if (wrapper && msgData && msgData.senderUid === auth.currentUser.uid) {
      const status = wrapper.querySelector(".message-status");
      if (status) {
        const readers = msgData.readBy ? Object.keys(msgData.readBy).filter(uid => uid !== auth.currentUser.uid) : [];
        if (readers.length === 0) {
          status.textContent = "Sent";
        } else {
          getUserNamesByUids(readers, (names) => {
            status.textContent =
              names.length === 1 ? "Viewed by " + names[0] :
              "Viewed by " + names.slice(0, 2).join(", ") + (names.length > 2 ? ` and ${names.length - 2} others` : "");
          });
        }
      }
    }
  });
}

function renderGroupMessage(msgKey, msg) {
  // prevent duplicate render if already exists
  if (document.getElementById("msg-" + msgKey)) return;

  const wrapper = document.createElement("div");
  wrapper.id = "msg-" + msgKey;
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = (msg.sender === auth.currentUser.email) ? "flex-end" : "flex-start";

  const name = document.createElement("span");
  const senderUid = msg.senderUid;
  if (senderUid && usersCache[senderUid]) {
    name.textContent = getFirstName(usersCache[senderUid].fullName || usersCache[senderUid].email);
  } else {
    name.textContent = getFirstName(msg.sender || "Unknown");
  }
  name.style.fontSize = "12px";
  name.style.color = "#666";
  name.style.margin = "2px 6px";

  const div = document.createElement("div");
  div.className = (msg.sender === auth.currentUser.email) ? "message-bubble sender" : "message-bubble receiver";
  div.textContent = msg.text;

  const time = document.createElement("span");
  time.className = "message-timestamp";
  time.textContent = formatTime(msg.ts);

  wrapper.appendChild(name);
  wrapper.appendChild(div);
  wrapper.appendChild(time);

  if (msg.senderUid === auth.currentUser.uid) {
    const status = document.createElement("span");
    status.className = "message-status";

    if (!msg.readBy) {
      status.textContent = "Sent";
    } else {
      const readers = Object.keys(msg.readBy).filter(uid => uid !== auth.currentUser.uid);
      if (readers.length === 0) {
        status.textContent = "Sent";
      } else {
        getUserNamesByUids(readers, (names) => {
          status.textContent =
            names.length === 1 ? "Viewed by " + names[0] :
            "Viewed by " + names.slice(0, 2).join(", ") + (names.length > 2 ? ` and ${names.length - 2} others` : "");
        });
      }
    }
    wrapper.appendChild(status);
  }

  groupMessages.appendChild(wrapper);
}

// ---------------- TYPING INDICATORS ----------------
// private typing
privateInput.addEventListener("input", () => {
  const user = auth.currentUser;
  if (!user || !privateUser) return;

  const chatId = getChatId(user.uid, privateUser);
  const typingPathRef = ref(db, "privateTyping/" + chatId + "/" + user.uid);

  // set as true/false via update to avoid overwriting siblings
  if (privateInput.value.trim() !== "") {
    update(typingPathRef, { [user.uid]: true }).catch(console.error);
  } else {
    update(typingPathRef, { [user.uid]: false }).catch(console.error);
  }
});

// group typing
groupInput.addEventListener("input", () => {
  const user = auth.currentUser;
  if (!user) return;
  const typingPathRef = ref(db, "groupTyping/" + user.uid);
  if (groupInput.value.trim() !== "") {
    update(typingPathRef, { [user.uid]: true }).catch(console.error);
  } else {
    update(typingPathRef, { [user.uid]: false }).catch(console.error);
  }
});

function loadTypingIndicators() {
  try { off(groupTypingRef); } catch (e) {}

  onValue(groupTypingRef, (snapshot) => {
    const data = snapshot.val() || {};
    const typingUsers = [];
    // Use usersCache for names to avoid additional listeners
    Object.keys(data).forEach(uid => {
      // value can be boolean or nested object; check truthiness
      const val = data[uid];
      if (uid !== auth.currentUser?.uid && val) {
        const name = usersCache[uid] ? getFirstName(usersCache[uid].fullName || usersCache[uid].email) : uid;
        typingUsers.push(name);
      }
    });

    if (typingUsers.length === 0) {
      typingIndicator.textContent = "";
    } else {
      typingIndicator.textContent = typingUsers.join(", ") + (typingUsers.length > 1 ? " are typing..." : " is typing...");
    }
  });
}

// ---------------- PRIVATE CHAT ----------------
function loadPrivateChat(otherUid) {
  // cleanup previous chat listeners
  if (currentChatRef) {
    try { off(currentChatRef); } catch (e) {}
  }
  const chatId = getChatId(auth.currentUser.uid, otherUid);
  currentChatRef = ref(db, "privateChats/" + chatId);

  // Use child_added & child_changed for incremental real-time updates
  // clear UI
  privateMessages.innerHTML = "";

  // child_added - render new message
  onChildAdded(currentChatRef, (child) => {
    const msg = child.val();
    renderPrivateMessage(chatId, child.key, msg);
    privateMessages.scrollTop = privateMessages.scrollHeight;

    // if incoming and unread -> mark read
    if (msg.senderUid !== auth.currentUser.uid && !msg.read) {
      const msgRef = ref(db, `privateChats/${chatId}/${child.key}`);
      update(msgRef, { read: true }).catch(console.error);
    }
  });

  // child_changed - update read status or edits
  onChildChanged(currentChatRef, (child) => {
    const msgKey = child.key;
    const msgData = child.val();
    // find message element and update status
    const wrappers = privateMessages.querySelectorAll(".message-wrapper");
    wrappers.forEach(w => {
      if (w.dataset.msgKey === msgKey) {
        const statusEl = w.querySelector(".message-status");
        if (statusEl) statusEl.textContent = msgData.read ? "Read" : "Sent";
      }
    });
  });

  // typing indicator for private chat
  if (currentPrivateTypingRef) {
    try { off(currentPrivateTypingRef); } catch (e) {}
  }
  currentPrivateTypingRef = ref(db, "privateTyping/" + chatId);
  onValue(currentPrivateTypingRef, (snapshot) => {
    const data = snapshot.val() || {};
    const typingUsers = Object.keys(data).filter(uid => uid !== auth.currentUser.uid && data[uid]);
    // remove old indicator if any
    const existing = privateMessages.querySelector(".typing-indicator");
    if (existing) existing.remove();

    if (typingUsers.length > 0) {
      const names = typingUsers.map(uid => usersCache[uid] ? getFirstName(usersCache[uid].fullName || usersCache[uid].email) : uid);
      const indicator = document.createElement("div");
      indicator.className = "typing-indicator";
      indicator.textContent = names[0] + (names.length > 1 ? ` and ${names.length - 1} others are typing...` : " is typing...");
      privateMessages.appendChild(indicator);
      privateMessages.scrollTop = privateMessages.scrollHeight;
    }
  });
}

function renderPrivateMessage(chatId, msgKey, msg) {
  // Avoid duplicate render
  if (privateMessages.querySelector(`[data-msg-key="${msgKey}"]`)) return;

  const wrapper = document.createElement("div");
  wrapper.className = "message-wrapper";
  wrapper.dataset.msgKey = msgKey;
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.alignItems = (msg.sender === auth.currentUser.email) ? "flex-end" : "flex-start";

  const name = document.createElement("span");
  const senderUid = msg.senderUid;
  if (senderUid && usersCache[senderUid]) {
    name.textContent = getFirstName(usersCache[senderUid].fullName || usersCache[senderUid].email);
  } else {
    name.textContent = getFirstName(msg.sender || "Unknown");
  }
  name.style.fontSize = "12px";
  name.style.color = "#666";
  name.style.marginBottom = "2px";
  name.style.marginLeft = "6px";
  name.style.marginRight = "6px";

  const div = document.createElement("div");
  div.className = (msg.sender === auth.currentUser.email) ? "message-bubble sender" : "message-bubble receiver";
  div.textContent = msg.text;

  const time = document.createElement("span");
  time.className = "message-timestamp";
  time.textContent = formatTime(msg.ts);

  wrapper.appendChild(name);
  wrapper.appendChild(div);
  wrapper.appendChild(time);

  if (msg.sender === auth.currentUser.email) {
    const status = document.createElement("span");
    status.className = "message-status";
    status.textContent = msg.read ? "Read" : "Sent";
    wrapper.appendChild(status);
  }

  privateMessages.appendChild(wrapper);
}

// ---------------- FORMAT TIMESTAMP ----------------
function formatTime(ts) {
  if (!ts) return "";
  try {
    const date = new Date(Number(ts));
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return "";
  }
}

// Helper for consistent chat IDs
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + "_" + uid2 : uid2 + "_" + uid1;
}

// Helper: Get first name from full name or email
function getFirstName(str) {
  if (!str) return "";
  if (str.includes("@")) return str.split("@")[0];
  return str.split(" ")[0];
}

// Helper: get user by email but now uses cache (faster)
function getUserByEmail(email, callback) {
  let firstName = email.split("@")[0];
  for (const uid in usersCache) {
    const u = usersCache[uid];
    if (u && u.email === email) {
      firstName = getFirstName(u.fullName || u.email);
      break;
    }
  }
  callback(firstName);
}

function getUserNamesByUids(uids, callback) {
  const names = [];
  uids.forEach(uid => {
    if (usersCache[uid]) names.push(getFirstName(usersCache[uid].fullName || usersCache[uid].email));
  });
  callback(names);
}

// ---------------- Cleanup helpers ----------------
function cleanupAllListeners() {
  try {
    off(usersRef);
  } catch (e) {}
  try {
    if (groupChildAddedListener) off(groupRef, "child_added", groupChildAddedListener);
    if (groupChildChangedListener) off(groupRef, "child_changed", groupChildChangedListener);
    off(groupTypingRef);
  } catch (e) {}
  try {
    if (currentChatRef) off(currentChatRef);
    if (currentPrivateTypingRef) off(currentPrivateTypingRef);
  } catch (e) {}
}

// call this before unloading page to mark offline
window.addEventListener("beforeunload", async () => {
  const user = auth.currentUser;
  if (user) {
    await update(ref(db, "users/" + user.uid), { online: false, lastSeen: Date.now() }).catch(() => {});
  }
  cleanupAllListeners();
});
