import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  update,
  onValue,
  onChildAdded,
  serverTimestamp,
  get,
  remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

/* ---------- firebase config ---------- */
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

/* ---------- UI elements ---------- */
const signupBtn = document.getElementById("signup-btn");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const fullnameInput = document.getElementById("fullname");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const authSection = document.getElementById("auth-section");
const chatSection = document.getElementById("chat-section");
const userEmail = document.getElementById("user-email");

const usersTab = document.getElementById("users-tab");
const groupsTab = document.getElementById("groups-tab");
const usersListContainer = document.getElementById("users-list-container");
const groupsListContainer = document.getElementById("groups-list-container");
const userListEl = document.getElementById("user-list");
const groupListEl = document.getElementById("group-list");
const newGroupNameInput = document.getElementById("new-group-name");
const createGroupBtn = document.getElementById("create-group-btn");

const chattingWith = document.getElementById("chatting-with");
const privateMessages = document.getElementById("private-messages");
const privateInput = document.getElementById("private-input");
const privateSend = document.getElementById("private-send");

const currentGroupEl = document.getElementById("current-group");
const groupMessages = document.getElementById("group-messages");
const groupInput = document.getElementById("group-input");
const groupSend = document.getElementById("group-send");
const groupTyping = document.getElementById("group-typing");

const privatePanel = document.getElementById("private-panel");
const groupPanel = document.getElementById("group-panel");

/* ---------- state ---------- */
let currentUser = null;
let selectedPrivateUid = null;
let selectedGroupId = null;

/* ---------- auth handlers ---------- */
signupBtn.addEventListener("click", async () => {
  const fullName = fullnameInput.value.trim();
  const email = emailInput.value.trim();
  const pwd = passwordInput.value;
  if (!fullName || !email || !pwd) return alert("Please fill all fields.");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pwd);
    const uid = cred.user.uid;
    await set(ref(db, `users/${uid}`), {
      email: cred.user.email,
      fullName,
      online: true,
      lastSeen: serverTimestamp()
    });
    fullnameInput.value = "";
    emailInput.value = "";
    passwordInput.value = "";
  } catch (err) {
    console.error(err);
    alert(err.message || "Signup failed");
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pwd = passwordInput.value;
  if (!email || !pwd) return alert("Please provide credentials.");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pwd);
    const uid = cred.user.uid;
    await update(ref(db, `users/${uid}`), { online: true, lastSeen: serverTimestamp() });
    emailInput.value = ""; passwordInput.value = "";
  } catch (err) {
    console.error(err);
    alert(err.message || "Login failed");
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  await update(ref(db, `users/${currentUser.uid}`), { online: false, lastSeen: serverTimestamp() });
  await signOut(auth);
});

/* ---------- auth state ---------- */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authSection.style.display = "none";
    chatSection.style.display = "block";
    userEmail.textContent = user.email;
    loadUsers();
    loadUserGroups();
    listenGroupTyping();
  } else {
    authSection.style.display = "block";
    chatSection.style.display = "none";
    resetUI();
  }
});

/* ---------- UI helpers ---------- */
function resetUI() {
  userListEl.innerHTML = "";
  groupListEl.innerHTML = "";
  privateMessages.innerHTML = "";
  groupMessages.innerHTML = "";
  currentGroupEl.textContent = "None";
  selectedGroupId = null;
  selectedPrivateUid = null;
  groupTyping.textContent = "";
  privatePanel.style.display = "none";
  groupPanel.style.display = "none";
}

/* ---------- sidebar tabs ---------- */
usersTab.addEventListener("click", () => {
  usersTab.classList.add("active");
  groupsTab.classList.remove("active");
  usersListContainer.classList.remove("hidden");
  groupsListContainer.classList.add("hidden");
});

groupsTab.addEventListener("click", () => {
  groupsTab.classList.add("active");
  usersTab.classList.remove("active");
  groupsListContainer.classList.remove("hidden");
  usersListContainer.classList.add("hidden");
  loadUserGroups();
});

/* ---------- USERS (private chat) ---------- */
function loadUsers() {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snap) => {
    userListEl.innerHTML = "";
    const meId = currentUser?.uid;
    let found = false;
    snap.forEach(child => {
      const uid = child.key;
      const data = child.val();
      if (!data || !data.email) return;
      if (uid === meId) return;
      found = true;
      const li = document.createElement("li");
      li.className = data.online ? "online" : "offline";
      li.innerHTML = `<div>${getFirstName(data.fullName || data.email)} <small style="opacity:.6">${data.online ? "online" : "offline"}</small></div>`;
      li.addEventListener("click", () => {
        openPrivateChat(uid, data);
      });
      userListEl.appendChild(li);
    });
    if (!found) {
      const li = document.createElement("li");
      li.className = "offline";
      li.textContent = "No other users found.";
      userListEl.appendChild(li);
    }
  });
}

function openPrivateChat(otherUid, otherData) {
  selectedPrivateUid = otherUid;
  chattingWith.textContent = getFirstName(otherData.fullName || otherData.email);
  selectedGroupId = null;
  currentGroupEl.textContent = "None";
  privatePanel.style.display = "flex";
  groupPanel.style.display = "none";
  loadPrivateMessages(otherUid);
}

privateSend.addEventListener("click", async () => {
  const text = privateInput.value.trim();
  if (!text || !selectedPrivateUid || !currentUser) return;
  const chatId = getChatId(currentUser.uid, selectedPrivateUid);
  const msgRef = push(ref(db, `privateChats/${chatId}`));
  await set(msgRef, {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    text,
    ts: Date.now(),
    read: false
  });
  privateInput.value = "";
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), false);
});

function loadPrivateMessages(otherUid) {
  if (!currentUser) return;
  privateMessages.innerHTML = "";
  const chatId = getChatId(currentUser.uid, otherUid);
  const refChats = ref(db, `privateChats/${chatId}`);
  onChildAdded(refChats, (snap) => {
    const m = snap.val();
    renderPrivateMessage(m);
    if (m.senderUid !== currentUser.uid && m.read === false) {
      set(ref(db, `privateChats/${chatId}/${snap.key}/read`), true);
    }
  });
  onValue(ref(db, `privateTyping/${chatId}`), (snap) => {
    const data = snap.val() || {};
    const otherTyping = Object.keys(data).some(uid => uid !== currentUser.uid && data[uid]);
    const existing = privateMessages.querySelector(".typing");
    if (existing) existing.remove();
    if (otherTyping) {
      const small = document.createElement("div");
      small.className = "typing";
      small.textContent = "They are typing...";
      privateMessages.appendChild(small);
    }
  });
}

function renderPrivateMessage(msg) {
  const wrapper = document.createElement("div");
  wrapper.className = msg.senderUid === currentUser.uid ? "msg sender" : "msg receiver";
  wrapper.textContent = msg.text;
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = formatTime(msg.ts) + (msg.senderUid === currentUser.uid ? (msg.read ? " • Read" : " • Sent") : "");
  wrapper.appendChild(meta);
  privateMessages.appendChild(wrapper);
  privateMessages.scrollTop = privateMessages.scrollHeight;
}

privateInput.addEventListener("input", async () => {
  if (!currentUser || !selectedPrivateUid) return;
  const chatId = getChatId(currentUser.uid, selectedPrivateUid);
  const val = privateInput.value.trim() !== "";
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), val);
});

/* ---------- GROUPS ---------- */
createGroupBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Login first");
  const name = newGroupNameInput.value.trim();
  if (!name) return alert("Enter a group name");
  try {
    const gRef = push(ref(db, "groupChats"));
    const gid = gRef.key;
    await set(ref(db, `groupChats/${gid}`), {
      name,
      creator: currentUser.uid,
      createdAt: Date.now()
    });
    await set(ref(db, `groupChats/${gid}/members/${currentUser.uid}`), true);
    await set(ref(db, `userGroups/${currentUser.uid}/${gid}`), true);
    await set(ref(db, `groupsByCreator/${currentUser.uid}/${gid}`), true);
    newGroupNameInput.value = "";
    loadUserGroups();
  } catch (err) {
    console.error(err);
    alert("Could not create group");
  }
});

async function loadUserGroups() {
  if (!currentUser) return;
  groupListEl.innerHTML = "";
  const snap = await get(ref(db, `userGroups/${currentUser.uid}`));
  const ids = snap.exists() ? Object.keys(snap.val()) : [];
  if (ids.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No groups yet. Create one.";
    groupListEl.appendChild(li);
    return;
  }
  for (const gid of ids) {
    const gSnap = await get(ref(db, `groupChats/${gid}/name`));
    const display = gSnap.exists() ? gSnap.val() : gid;
    const li = document.createElement("li");
    li.textContent = display;
    li.addEventListener("click", () => selectGroup(gid, display));

    const menu = document.createElement("button");
    menu.textContent = "⋮";
    menu.className = "btn small outline";
    menu.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Leave this group?")) {
        await remove(ref(db, `groupChats/${gid}/members/${currentUser.uid}`));
        await remove(ref(db, `userGroups/${currentUser.uid}/${gid}`));
        loadUserGroups();
        resetUI();
      }
    });
    li.appendChild(menu);

    groupListEl.appendChild(li);
  }
}

async function selectGroup(gid, displayName) {
  if (!currentUser) return;
  const memberSnap = await get(ref(db, `groupChats/${gid}/members/${currentUser.uid}`));
  if (!memberSnap.exists()) return alert("You are not a member of that group.");
  selectedGroupId = gid;
  currentGroupEl.textContent = displayName || gid;
  privatePanel.style.display = "none";
  groupPanel.style.display = "flex";
  groupMessages.innerHTML = "";
  onChildAdded(ref(db, `groupChats/${gid}/messages`), (snap) => {
    const m = snap.val();
    renderGroupMessage(m, gid, snap.key);
    if (m.senderUid !== currentUser.uid) {
      set(ref(db, `groupChats/${gid}/messages/${snap.key}/readBy/${currentUser.uid}`), true);
    }
  });
}

groupSend.addEventListener("click", async () => {
  if (!currentUser || !selectedGroupId) return alert("Select a group first.");
  const text = groupInput.value.trim();
  if (!text) return;
  const mem = await get(ref(db, `groupChats/${selectedGroupId}/members/${currentUser.uid}`));
  if (!mem.exists()) return alert("You are not a member of this group.");
  const mRef = push(ref(db, `groupChats/${selectedGroupId}/messages`));
  await set(mRef, {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    text,
    ts: Date.now(),
    readBy: {}
  });
  groupInput.value = "";
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), false);
});

function renderGroupMessage(m, gid, messageKey) {
  const wrapper = document.createElement("div");
  wrapper.className = m.senderUid === currentUser.uid ? "msg sender" : "msg receiver";
  wrapper.textContent = m.text;
  const meta = document.createElement("div");
  meta.className = "meta";
  if (m.senderUid === currentUser.uid) {
    const readers = m.readBy ? Object.keys(m.readBy).filter(u=>u!==currentUser.uid) : [];
    meta.textContent = `${formatTime(m.ts)} • ${readers.length ? `Viewed (${readers.length})` : 'Sent'}`;
  } else {
    meta.textContent = formatTime(m.ts);
  }
  wrapper.appendChild(meta);
  groupMessages.appendChild(wrapper);
  groupMessages.scrollTop = groupMessages.scrollHeight;
}

groupInput.addEventListener("input", async () => {
  if (!currentUser || !selectedGroupId) return;
  const v = groupInput.value.trim() !== "";
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), v);
});

function listenGroupTyping() {
  onValue(ref(db, `groupTyping`), async (snap) => {
    const data = snap.val() || {};
    const typingNames = [];
    for (const gid of Object.keys(data)) {
      const groupTypingObj = data[gid] || {};
      for (const uid of Object.keys(groupTypingObj)) {
        if (groupTypingObj[uid] && uid !== currentUser?.uid) {
          const member = await get(ref(db, `groupChats/${gid}/members/${uid}`));
          if (member.exists()) {
            const uSnap = await get(ref(db, `users/${uid}`));
            if (uSnap.exists()) typingNames.push(getFirstName(uSnap.val().fullName || uSnap.val().email));
          }
        }
      }
    }
    groupTyping.textContent = typingNames.length ? (typingNames.join(", ") + (typingNames.length>1 ? " are typing..." : " is typing...")) : "";
  });
}

/* ---------- utils ---------- */
function getChatId(a,b){ return a < b ? `${a}_${b}` : `${b}_${a}`; }
function getFirstName(s){ if(!s) return ""; if(s.includes("@")) return s.split("@")[0]; return s.split(" ")[0]; }
function formatTime(ts){ if(!ts) return ""; const d = new Date(ts); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
