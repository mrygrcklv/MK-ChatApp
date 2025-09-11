
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
  set,
  push,
  onChildAdded,
  onValue,
  update,
  get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

/* ---------- firebase config (keep your real config) ---------- */
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

const usersTabBtn = document.getElementById("users-tab");
const groupsTabBtn = document.getElementById("groups-tab");
const usersListContainer = document.getElementById("users-list-container");
const groupsListContainer = document.getElementById("groups-list-container");
const userListEl = document.getElementById("user-list");
const groupListEl = document.getElementById("group-list");
const newGroupNameInput = document.getElementById("new-group-name");
const createGroupBtn = document.getElementById("create-group-btn");
const joinGroupBtn = document.getElementById("join-group-btn");
const joinGroupInput = document.getElementById("join-group-id");

const chattingWith = document.getElementById("chatting-with");
const privateMessages = document.getElementById("private-messages");
const privateInput = document.getElementById("private-input");
const privateSend = document.getElementById("private-send");
const privateTypingEl = document.getElementById("private-typing");

const currentGroupEl = document.getElementById("current-group");
const groupMessages = document.getElementById("group-messages");
const groupInput = document.getElementById("group-input");
const groupSend = document.getElementById("group-send");
const groupTypingEl = document.getElementById("group-typing");

/* Modal */
const groupModal = document.getElementById("group-modal");
const modalGroupName = document.getElementById("modal-group-name");
const modalCreate = document.getElementById("modal-create");
const modalCancel = document.getElementById("modal-cancel");
const createGroupBtnModal = document.getElementById("create-group-btn");

/* ---------- state ---------- */
let currentUser = null;
let selectedPrivateUid = null;
let selectedGroupId = null;
const nameCache = new Map(); // uid -> display name

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
      lastSeen: Date.now()
    });
    fullnameInput.value = ""; emailInput.value = ""; passwordInput.value = "";
  } catch (err) {
    console.error(err); alert(err.message || "Signup failed");
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pwd = passwordInput.value;
  if (!email || !pwd) return alert("Enter credentials");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pwd);
    const uid = cred.user.uid;
    await update(ref(db, `users/${uid}`), { online: true, lastSeen: Date.now() });
    emailInput.value = ""; passwordInput.value = "";
  } catch (err) {
    console.error(err); alert(err.message || "Login failed");
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  await update(ref(db, `users/${currentUser.uid}`), { online: false, lastSeen: Date.now() });
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
    listenGlobalGroupTyping();
  } else {
    authSection.style.display = "block";
    chatSection.style.display = "none";
    userListEl.innerHTML = ""; groupListEl.innerHTML = ""; privateMessages.innerHTML = ""; groupMessages.innerHTML = "";
    selectedPrivateUid = null; selectedGroupId = null; currentUser = null;
  }
});

/* ---------- sidebar tab switching ---------- */
usersTabBtn.addEventListener("click", () => {
  usersTabBtn.classList.add("active"); groupsTabBtn.classList.remove("active");
  usersListContainer.style.display = ""; groupsListContainer.style.display = "none";
});
groupsTabBtn.addEventListener("click", () => {
  groupsTabBtn.classList.add("active"); usersTabBtn.classList.remove("active");
  usersListContainer.style.display = "none"; groupsListContainer.style.display = "";
  loadUserGroups();
});

/* ---------- USERS (private) ---------- */
function loadUsers() {
  onValue(ref(db, "users"), (snap) => {
    userListEl.innerHTML = "";
    const me = currentUser?.uid;
    snap.forEach(child => {
      const uid = child.key;
      const data = child.val();
      if (!data || !data.email) return;
      if (uid === me) {
        // cache my name
        nameCache.set(uid, getFirstName(data.fullName || data.email));
        return;
      }
      const li = document.createElement("li");
      li.className = data.online ? "online" : "offline";
      li.innerHTML = `<div>${getFirstName(data.fullName || data.email)} <small style="opacity:.6">${data.online ? 'online' : 'offline'}</small></div>`;
      li.addEventListener("click", () => {
        selectedPrivateUid = uid;
        chattingWith.textContent = getFirstName(data.fullName || data.email);
        loadPrivateChat(uid);
      });
      userListEl.appendChild(li);
      // cache
      nameCache.set(uid, getFirstName(data.fullName || data.email));
    });
  });
}

/* ---------- PRIVATE CHAT ---------- */
function getChatId(a,b){ return a < b ? `${a}_${b}` : `${b}_${a}`; }

function loadPrivateChat(otherUid) {
  if (!currentUser) return;
  selectedGroupId = null;
  groupMessages.innerHTML = ""; currentGroupEl && (currentGroupEl.textContent = "None");
  privateMessages.innerHTML = "";
  const chatId = getChatId(currentUser.uid, otherUid);
  // listen messages (onChildAdded => real-time append)
  onChildAdded(ref(db, `privateChats/${chatId}`), (snap) => {
    const msg = snap.val();
    renderPrivateMessage(msg, snap.key, chatId);
    // if I'm receiver mark read
    if (msg.senderUid !== currentUser.uid) {
      update(ref(db, `privateChats/${chatId}/${snap.key}/readBy`), { [currentUser.uid]: true });
    }
  });
  // typing indicator for private - show name
  onValue(ref(db, `privateTyping/${chatId}/${otherUid}`), (snap) => {
    const val = snap.val();
    if (val) {
      const nm = nameCache.get(otherUid) || otherUid;
      privateTypingEl.textContent = `${nm} is typing...`;
    } else privateTypingEl.textContent = "";
  });
}

function renderPrivateMessage(msg, key, chatId) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg " + (msg.senderUid === currentUser.uid ? "sender" : "receiver");
  const textNode = document.createElement("div"); textNode.textContent = msg.text;
  const meta = document.createElement("div"); meta.className = "meta";
  const ts = document.createElement("div"); ts.className = "message-timestamp"; ts.textContent = formatTime(msg.ts || msg.ts === 0 ? msg.ts : msg.timestamp);
  meta.appendChild(ts);

  // read-status element (updated realtime)
  const statusEl = document.createElement("div"); statusEl.className = "message-status";
  meta.appendChild(statusEl);

  wrapper.appendChild(textNode);
  wrapper.appendChild(meta);
  privateMessages.appendChild(wrapper);
  privateMessages.scrollTop = privateMessages.scrollHeight;

  // realtime update of readBy for this message
  const readByRef = ref(db, `privateChats/${chatId}/${key}/readBy`);
  onValue(readByRef, (snap) => {
    const obj = snap.val() || {};
    // if I am sender, show who viewed
    if (msg.senderUid === currentUser.uid) {
      const otherUid = Object.keys(obj).find(u => u !== currentUser.uid);
      if (!otherUid) {
        statusEl.textContent = "Sent";
      } else {
        const name = nameCache.get(otherUid) || otherUid;
        statusEl.textContent = `Viewed by ${name}`;
      }
    } else {
      // receiver side need not show special
      statusEl.textContent = "";
    }
  });
}

/* private typing write */
privateInput.addEventListener("input", async () => {
  if (!currentUser || !selectedPrivateUid) return;
  const chatId = getChatId(currentUser.uid, selectedPrivateUid);
  const val = privateInput.value.trim() !== "";
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), val);
});

/* send private */
privateSend.addEventListener("click", async () => {
  if (!currentUser || !selectedPrivateUid) return;
  const text = privateInput.value.trim(); if (!text) return;
  const chatId = getChatId(currentUser.uid, selectedPrivateUid);
  const msgRef = push(ref(db, `privateChats/${chatId}`));
  await set(msgRef, {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    text,
    ts: Date.now(),
    readBy: { [currentUser.uid]: true }
  });
  privateInput.value = "";
  // clear typing
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), false);
});

/* ---------- GROUPS ---------- */
createGroupBtn.addEventListener("click", () => { groupModal.style.display = "flex"; modalGroupName.value = ""; });
modalCancel.addEventListener("click", () => groupModal.style.display = "none");

modalCreate.addEventListener("click", async () => {
  if (!currentUser) return alert("Login first");
  const name = modalGroupName.value.trim();
  if (!name) return alert("Enter group name");
  // push new group
  const gRef = push(ref(db, "groupChats"));
  const gid = gRef.key;
  await set(ref(db, `groupChats/${gid}`), { name, creator: currentUser.uid, createdAt: Date.now() });
  await set(ref(db, `groupChats/${gid}/members/${currentUser.uid}`), true);
  await set(ref(db, `userGroups/${currentUser.uid}/${gid}`), true);
  await set(ref(db, `groupsByCreator/${currentUser.uid}/${gid}`), true);
  groupModal.style.display = "none";
  loadUserGroups();
});

joinGroupBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Login first");
  const gid = joinGroupInput.value.trim(); if (!gid) return alert("Enter group ID");
  const snap = await get(ref(db, `groupChats/${gid}`));
  if (!snap.exists()) return alert("Group not found");
  await set(ref(db, `groupChats/${gid}/members/${currentUser.uid}`), true);
  await set(ref(db, `userGroups/${currentUser.uid}/${gid}`), true);
  loadUserGroups();
  joinGroupInput.value = "";
});

async function loadUserGroups() {
  if (!currentUser) return;
  groupListEl.innerHTML = "";
  const snap = await get(ref(db, `userGroups/${currentUser.uid}`));
  const ids = snap.exists() ? Object.keys(snap.val()) : [];
  if (ids.length === 0) {
    const li = document.createElement("li"); li.textContent = "No groups yet. Create or join one."; groupListEl.appendChild(li); return;
  }
  for (const gid of ids) {
    const nameSnap = await get(ref(db, `groupChats/${gid}/name`));
    const display = nameSnap.exists() ? nameSnap.val() : gid;
    const li = document.createElement("li");
    li.textContent = `${display} (${gid.slice(0,6)})`;
    li.addEventListener("click", () => selectGroup(gid, display));
    // copy id button
    const btn = document.createElement("button"); btn.textContent = "ID"; btn.className = "btn small outline";
    btn.addEventListener("click",(e)=>{ e.stopPropagation(); navigator.clipboard?.writeText(gid).then(()=>alert("Group ID copied")); });
    li.appendChild(btn);
    groupListEl.appendChild(li);
  }
}

async function selectGroup(gid, displayName) {
  if (!currentUser) return;
  // verify membership
  const memberSnap = await get(ref(db, `groupChats/${gid}/members/${currentUser.uid}`));
  if (!memberSnap.exists()) return alert("You are not a member of this group.");
  selectedGroupId = gid;
  currentGroupEl.textContent = displayName || gid;
  groupMessages.innerHTML = "";
  // fetch members count once and cache
  const membersSnap = await get(ref(db, `groupChats/${gid}/members`));
  const memberUids = membersSnap.exists() ? Object.keys(membersSnap.val()) : [];
  const memberCount = memberUids.length;

  // listen messages (append)
  onChildAdded(ref(db, `groupChats/${gid}/messages`), (snap) => {
    const msg = snap.val();
    renderGroupMessage(msg, snap.key, gid, memberCount);
    // mark read by me
    if (msg.senderUid !== currentUser.uid) {
      update(ref(db, `groupChats/${gid}/messages/${snap.key}/readBy`), { [currentUser.uid]: true });
    }
  });

  // typing indicator for this group
  onValue(ref(db, `groupTyping/${gid}`), async (snap) => {
    const obj = snap.val() || {};
    const typingUids = Object.keys(obj).filter(u => obj[u] && u !== currentUser.uid);
    if (typingUids.length === 0) {
      groupTypingEl.textContent = "";
    } else {
      // map to names (try cache)
      const names = await Promise.all(typingUids.map(async uid => await getDisplayName(uid)));
      groupTypingEl.textContent = names.join(", ") + (names.length > 1 ? " are typing..." : " is typing...");
    }
  });
}

function renderGroupMessage(msg, key, gid, memberCount) {
  const wrapper = document.createElement("div");
  wrapper.className = "msg " + (msg.senderUid === currentUser.uid ? "sender" : "receiver");
  const text = document.createElement("div"); text.textContent = msg.text;
  const meta = document.createElement("div"); meta.className = "meta";
  const ts = document.createElement("div"); ts.className = "message-timestamp"; ts.textContent = formatTime(msg.ts || msg.timestamp);
  meta.appendChild(ts);

  const statusEl = document.createElement("div"); statusEl.className = "message-status";
  meta.appendChild(statusEl);

  wrapper.appendChild(text); wrapper.appendChild(meta);
  groupMessages.appendChild(wrapper);
  groupMessages.scrollTop = groupMessages.scrollHeight;

  // Realtime update of readBy for this group message
  const readByRef = ref(db, `groupChats/${gid}/messages/${key}/readBy`);
  onValue(readByRef, async (snap) => {
    const readObj = snap.val() || {};
    // if sender view
    if (msg.senderUid === currentUser.uid) {
      const readerUids = Object.keys(readObj).filter(u => u !== currentUser.uid);
      if (readerUids.length === 0) {
        statusEl.textContent = "Sent";
      } else if (readerUids.length === memberCount - 1) {
        statusEl.textContent = "Viewed by Everyone";
      } else if (readerUids.length === 1) {
        const nm = await getDisplayName(readerUids[0]);
        statusEl.textContent = `Viewed by ${nm}`;
      } else {
        // few readers — show comma list (up to 3)
        const names = await Promise.all(readerUids.slice(0,3).map(uid => getDisplayName(uid)));
        statusEl.textContent = `Viewed by ${names.join(", ")}` + (readerUids.length > 3 ? ` and ${readerUids.length - 3} others` : "");
      }
    } else {
      // receiver side: nothing
      statusEl.textContent = "";
    }
  });
}

/* group typing write */
groupInput.addEventListener("input", async () => {
  if (!currentUser || !selectedGroupId) return;
  const val = groupInput.value.trim() !== "";
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), val);
});

/* group send */
groupSend.addEventListener("click", async () => {
  if (!currentUser || !selectedGroupId) return alert("Select a group first");
  const text = groupInput.value.trim(); if (!text) return;
  const mRef = push(ref(db, `groupChats/${selectedGroupId}/messages`));
  await set(mRef, {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    text,
    ts: Date.now(),
    readBy: { [currentUser.uid]: true }
  });
  groupInput.value = "";
  // clear typing
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), false);
});

/* ---------- helpers ---------- */
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function getFirstName(str) {
  if (!str) return "";
  if (str.includes("@")) return str.split("@")[0];
  return str.split(" ")[0];
}
async function getDisplayName(uid) {
  if (nameCache.has(uid)) return nameCache.get(uid);
  try {
    const s = await get(ref(db, `users/${uid}`));
    if (s.exists()) {
      const v = s.val();
      const name = getFirstName(v.fullName || v.fullName || v.email || uid);
      nameCache.set(uid, name);
      return name;
    }
  } catch (e) { /* ignore */ }
  nameCache.set(uid, uid);
  return uid;
}

/* global watcher: show who is typing in groups you belong to */
function listenGlobalGroupTyping() {
  onValue(ref(db, `groupTyping`), async (snap) => {
    const data = snap.val() || {};
    const typingNames = [];
    for (const gid of Object.keys(data)) {
      const groupObj = data[gid] || {};
      for (const uid of Object.keys(groupObj)) {
        if (uid === currentUser.uid) continue;
        if (groupObj[uid]) {
          // only include if member in that group (cheap check)
          const mem = await get(ref(db, `groupChats/${gid}/members/${uid}`));
          if (mem.exists()) {
            typingNames.push(await getDisplayName(uid));
          }
        }
      }
    }
    // show up to 3 names across UI (main group typing element)
    const el = document.getElementById("group-typing");
    el.textContent = typingNames.length ? (typingNames.slice(0,3).join(", ") + (typingNames.length>1 ? " are typing..." : " is typing...")) : "";
  });
}

/* load groups for sidebar */
async function loadUserGroups() {
  if (!currentUser) return;
  groupListEl.innerHTML = "";
  const snap = await get(ref(db, `userGroups/${currentUser.uid}`));
  const ids = snap.exists() ? Object.keys(snap.val()) : [];
  if (ids.length === 0) {
    const li = document.createElement("li"); li.textContent = "No groups yet. Create or join."; groupListEl.appendChild(li); return;
  }
  for (const gid of ids) {
    const gNameSnap = await get(ref(db, `groupChats/${gid}/name`));
    const display = gNameSnap.exists() ? gNameSnap.val() : gid;
    const li = document.createElement("li"); li.textContent = display;
    li.addEventListener("click", () => selectGroup(gid, display));
    const idBtn = document.createElement("button"); idBtn.textContent = "ID"; idBtn.className = "btn small outline";
    idBtn.addEventListener("click",(e)=>{ e.stopPropagation(); navigator.clipboard?.writeText(gid).then(()=>alert("Copied group ID"))});
    li.appendChild(idBtn);
    groupListEl.appendChild(li);
  }
}

/* small cache */
const nameCache = new Map();
