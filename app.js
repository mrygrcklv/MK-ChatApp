import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase, ref, push, set, update, onChildAdded, onValue, get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

/* ---------- firebase config (your project's values) ---------- */
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
const joinGroupInput = document.getElementById("join-group-id");
const joinGroupBtn = document.getElementById("join-group-btn");

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

/* ---------- state ---------- */
let currentUser = null;
let selectedPrivateUid = null;
let selectedGroupId = null;
let messageListeners = {}; // to keep track of message-level listeners for updates

/* ---------- Auth ---------- */
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
    console.error(err);
    alert(err.message || "Signup failed");
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pwd = passwordInput.value;
  if (!email || !pwd) return alert("Provide credentials");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pwd);
    await update(ref(db, `users/${cred.user.uid}`), { online: true, lastSeen: Date.now() });
    emailInput.value = ""; passwordInput.value = "";
  } catch (err) {
    console.error(err);
    alert(err.message || "Login failed");
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  await update(ref(db, `users/${currentUser.uid}`), { online: false, lastSeen: Date.now() });
  await signOut(auth);
});

/* ---------- Auth State ---------- */
onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    authSection.style.display = "none";
    chatSection.style.display = "block";
    userEmail.textContent = user.email;
    loadUsers();
    loadUserGroups();
    watchGroupTyping(); // shows who is typing in groups you're in
  } else {
    authSection.style.display = "block";
    chatSection.style.display = "none";
    resetUI();
  }
});

function resetUI(){
  userListEl.innerHTML = "";
  groupListEl.innerHTML = "";
  privateMessages.innerHTML = "";
  groupMessages.innerHTML = "";
  chattingWith.textContent = "Nobody";
  currentGroupEl.textContent = "None";
  selectedGroupId = null;
  selectedPrivateUid = null;
  messageListeners = {};
}

/* ---------- Tabs ---------- */
usersTab.addEventListener("click", ()=> {
  usersTab.classList.add("active");
  groupsTab.classList.remove("active");
  usersListContainer.classList.remove("hidden");
  groupsListContainer.classList.add("hidden");
});
groupsTab.addEventListener("click", ()=> {
  groupsTab.classList.add("active");
  usersTab.classList.remove("active");
  groupsListContainer.classList.remove("hidden");
  usersListContainer.classList.add("hidden");
  loadUserGroups();
});

/* ---------- Users / Private Chats ---------- */
function loadUsers(){
  userListEl.innerHTML = "";
  const usersRef = ref(db, "users");
  onValue(usersRef, snap => {
    userListEl.innerHTML = "";
    const me = currentUser?.uid;
    snap.forEach(child => {
      const uid = child.key;
      const u = child.val();
      if (!u || !u.email) return;
      if (uid === me) return;
      const li = document.createElement("li");
      li.className = u.online ? "online" : "offline";
      li.innerHTML = `<div>${getFirstName(u.fullName||u.email)} <small style="opacity:.6">${u.online ? "online" : "offline"}</small></div>`;
      li.addEventListener("click", ()=> openPrivateChat(uid, u));
      userListEl.appendChild(li);
    });
  });
}

function openPrivateChat(otherUid, otherData){
  selectedPrivateUid = otherUid;
  selectedGroupId = null;
  chattingWith.textContent = getFirstName(otherData.fullName || otherData.email);
  privateMessages.innerHTML = "";
  privateTypingEl.textContent = "";
  subscribePrivateChat(otherUid);
}

/* subscribe to private chat; real-time read receipts implemented */
function subscribePrivateChat(otherUid){
  if (!currentUser) return;
  const chatId = getChatId(currentUser.uid, otherUid);
  const chatRef = ref(db, `privateChats/${chatId}`);
  // Listen additions
  onChildAdded(chatRef, snapshot => {
    const key = snapshot.key;
    const msg = snapshot.val();
    renderPrivateMessage(key, msg);
    // if this client is receiver and message unread, mark read and set readBy for sender to see
    if (msg.senderUid !== currentUser.uid && !msg.read) {
      set(ref(db, `privateChats/${chatId}/${key}/read`), true);
    }
    // attach listener for changes to this message (to update read status in real-time)
    if (!messageListeners[key]) {
      messageListeners[key] = onValue(ref(db, `privateChats/${chatId}/${key}`), snap => {
        const updated = snap.val();
        updatePrivateMessageStatus(key, updated);
      });
    }
  });
  // typing indicator for private
  onValue(ref(db, `privateTyping/${chatId}`), snap => {
    const data = snap.val() || {};
    const otherTypingUid = Object.keys(data).find(uid => uid !== currentUser.uid && data[uid]);
    if (!otherTypingUid) {
      privateTypingEl.textContent = "";
      return;
    }
    // get name
    get(ref(db, `users/${otherTypingUid}`)).then(s => {
      const u = s.val();
      privateTypingEl.textContent = (u?.fullName ? getFirstName(u.fullName) : (u?.email?.split("@")[0] || "Someone")) + " is typing...";
    });
  });
}

/* render private message bubble with data-key */
function renderPrivateMessage(key, msg){
  const wrapper = document.createElement("div");
  wrapper.id = `priv-${key}`;
  wrapper.className = msg.senderUid === currentUser.uid ? "msg sender" : "msg receiver";
  wrapper.innerHTML = `${escapeHtml(msg.text)}<div class="meta" id="meta-${key}">${formatTime(msg.ts)}${msg.senderUid===currentUser.uid ? ` • ${msg.read ? '<span class="receipt">Read</span>' : '<span class="receipt">Sent</span>'}` : ''}</div>`;
  privateMessages.appendChild(wrapper);
  privateMessages.scrollTop = privateMessages.scrollHeight;
}

/* update private message status (real-time) */
function updatePrivateMessageStatus(key, updated){
  const meta = document.getElementById(`meta-${key}`);
  if (!meta) return;
  // use light blue for time & receipts (meta styles in CSS)
  const time = formatTime(updated.ts);
  let receiptText = "";
  if (updated.senderUid === currentUser.uid) {
    receiptText = updated.read ? " • Read" : " • Sent";
  }
  meta.innerHTML = `${time}${receiptText ? `<span class="receipt">${receiptText}</span>` : ''}`;
}

/* private typing writer */
privateInput.addEventListener("input", async () => {
  if (!currentUser || !selectedPrivateUid) return;
  const chatId = getChatId(currentUser.uid, selectedPrivateUid);
  const val = privateInput.value.trim() !== "";
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), val);
});

/* private send */
privateSend.addEventListener("click", async () => {
  if (!currentUser || !selectedPrivateUid) return;
  const text = privateInput.value.trim();
  if (!text) return;
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
  // clear typing flag
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), false);
});

/* ---------- GROUPS ---------- */
createGroupBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Login first");
  const name = newGroupNameInput.value.trim();
  if (!name) return alert("Enter group name");
  // create group
  const gRef = push(ref(db, "groupChats"));
  const gid = gRef.key;
  await set(ref(db, `groupChats/${gid}`), {
    name,
    creator: currentUser.uid,
    createdAt: Date.now()
  });
  // add membership + userGroups + groupsByCreator
  await set(ref(db, `groupChats/${gid}/members/${currentUser.uid}`), true);
  await set(ref(db, `userGroups/${currentUser.uid}/${gid}`), true);
  await set(ref(db, `groupsByCreator/${currentUser.uid}/${gid}`), true);
  newGroupNameInput.value = "";
  loadUserGroups();
});

joinGroupBtn.addEventListener("click", async () => {
  if (!currentUser) return alert("Login first");
  const gid = joinGroupInput.value.trim();
  if (!gid) return alert("Enter group ID");
  const snap = await get(ref(db, `groupChats/${gid}`));
  if (!snap.exists()) return alert("Group not found");
  await set(ref(db, `groupChats/${gid}/members/${currentUser.uid}`), true);
  await set(ref(db, `userGroups/${currentUser.uid}/${gid}`), true);
  joinGroupInput.value = "";
  loadUserGroups();
});

async function loadUserGroups(){
  if (!currentUser) return;
  groupListEl.innerHTML = "";
  const snap = await get(ref(db, `userGroups/${currentUser.uid}`));
  const ids = snap.exists() ? Object.keys(snap.val()) : [];
  if (ids.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No groups yet. Create or join one.";
    groupListEl.appendChild(li);
    return;
  }
  for (const gid of ids) {
    const gSnap = await get(ref(db, `groupChats/${gid}/name`));
    const display = gSnap.exists() ? gSnap.val() : gid;
    const li = document.createElement("li");
    li.textContent = display;
    li.addEventListener("click", () => selectGroup(gid, display));
    const copyBtn = document.createElement("button");
    copyBtn.className = "btn small outline";
    copyBtn.textContent = "ID";
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard?.writeText(gid).then(()=> alert("Group ID copied"));
    });
    li.appendChild(copyBtn);
    groupListEl.appendChild(li);
  }
}

/* select group and listen messages; implement group read receipts logic */
async function selectGroup(gid, displayName){
  if (!currentUser) return;
  const memberSnap = await get(ref(db, `groupChats/${gid}/members/${currentUser.uid}`));
  if (!memberSnap.exists()) return alert("You are not a member of this group.");
  selectedGroupId = gid;
  currentGroupEl.textContent = displayName;
  groupMessages.innerHTML = "";
  // load members once for read logic
  const membersSnap = await get(ref(db, `groupChats/${gid}/members`));
  const members = membersSnap.exists() ? Object.keys(membersSnap.val()) : [];
  const membersCount = members.length;
  // listen message additions
  onChildAdded(ref(db, `groupChats/${gid}/messages`), snapshot => {
    const key = snapshot.key;
    const msg = snapshot.val();
    renderGroupMessage(key, msg, membersCount, members);
    // mark read for the current user if not sender
    if (msg.senderUid !== currentUser.uid) {
      set(ref(db, `groupChats/${gid}/messages/${key}/readBy/${currentUser.uid}`), true);
    }
    // listen for readBy changes for realtime status
    if (!messageListeners[`g-${key}`]) {
      messageListeners[`g-${key}`] = onValue(ref(db, `groupChats/${gid}/messages/${key}/readBy`), snapRB => {
        updateGroupMessageReceipt(key, snapRB.val(), membersCount);
      });
    }
  });
}

/* render group message */
function renderGroupMessage(key, msg, membersCount, members){
  const wrapper = document.createElement("div");
  wrapper.id = `grp-${key}`;
  wrapper.className = msg.senderUid === currentUser.uid ? "msg sender" : "msg receiver";
  // sender name
  const nameSpan = document.createElement("div");
  get(ref(db, `users/${msg.senderUid}`)).then(s => {
    const u = s.val();
    nameSpan.textContent = u?.fullName ? getFirstName(u.fullName) : (u?.email?.split("@")[0] || "Unknown");
    nameSpan.style.fontSize = "12px";
    nameSpan.style.color = "#666";
    wrapper.prepend(nameSpan);
  });
  wrapper.innerHTML += `${escapeHtml(msg.text)}<div class="meta" id="grp-meta-${key}">${formatTime(msg.ts)} • ${formatGroupReceipt(msg.readBy, membersCount)}</div>`;
  groupMessages.appendChild(wrapper);
  groupMessages.scrollTop = groupMessages.scrollHeight;
}

/* compute group receipt text */
function formatGroupReceipt(readByObj, membersCount){
  const readers = readByObj ? Object.keys(readByObj).filter(Boolean) : [];
  // exclude sender count logic handled by caller who supplies membersCount
  const viewers = readers.length;
  if (viewers === 0) return "Sent";
  if (viewers === 1) {
    // We'll show name of the first reader later when update listener triggers (we need UID -> name)
    return "Viewed by someone";
  }
  if (viewers >= membersCount - 1) return "Viewed by Everyone";
  return `Viewed by ${viewers}`;
}

/* update group message receipt (realtime) */
async function updateGroupMessageReceipt(key, readByObj, membersCount){
  const el = document.getElementById(`grp-meta-${key}`);
  if (!el) return;
  const readers = readByObj ? Object.keys(readByObj).filter(Boolean) : [];
  if (readers.length === 0) {
    el.textContent = `${el.textContent.split("•")[0].trim()} • Sent`;
    return;
  }
  if (readers.length >= membersCount - 1) {
    el.textContent = `${el.textContent.split("•")[0].trim()} • Viewed by Everyone`;
    return;
  }
  if (readers.length === 1) {
    // get that user's name
    const uid = readers[0];
    const uSnap = await get(ref(db, `users/${uid}`));
    const uname = uSnap.exists() ? (uSnap.val().fullName ? getFirstName(uSnap.val().fullName) : (uSnap.val().email.split("@")[0])) : "Someone";
    el.textContent = `${el.textContent.split("•")[0].trim()} • Viewed by ${uname}`;
    return;
  }
  // default fallback: show count
  el.textContent = `${el.textContent.split("•")[0].trim()} • Viewed by ${readers.length}`;
}

/* send group message */
groupSend.addEventListener("click", async () => {
  if (!currentUser || !selectedGroupId) return alert("Select a group first.");
  const text = groupInput.value.trim();
  if (!text) return;
  const mRef = push(ref(db, `groupChats/${selectedGroupId}/messages`));
  await set(mRef, {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    text,
    ts: Date.now(),
    readBy: {} // empty; others will set themselves true when they view
  });
  groupInput.value = "";
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), false);
});

/* group typing production (shows "{name} is typing" for any typing users in current group) */
groupInput.addEventListener("input", async () => {
  if (!currentUser || !selectedGroupId) return;
  const v = groupInput.value.trim() !== "";
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), v);
});

/* watch typing across groups you belong to; show names for current selectedGroupId only */
function watchGroupTyping(){
  onValue(ref(db, `groupTyping`), async snap => {
    const data = snap.val() || {};
    if (!selectedGroupId) {
      groupTypingEl.textContent = "";
      return;
    }
    const groupTypingObj = data[selectedGroupId] || {};
    const uids = Object.keys(groupTypingObj).filter(uid => groupTypingObj[uid] && uid !== currentUser.uid);
    if (uids.length === 0) { groupTypingEl.textContent = ""; return; }
    // map first 2 names
    const promises = uids.slice(0,3).map(uid => get(ref(db, `users/${uid}`)));
    const results = await Promise.all(promises);
    const names = results.map(s => {
      const u = s.val();
      if (!u) return "Someone";
      return u.fullName ? getFirstName(u.fullName) : (u.email? u.email.split("@")[0] : "Someone");
    });
    groupTypingEl.textContent = names.join(", ") + (names.length>1 ? " are typing..." : " is typing...");
  });
}

/* ---------- Helpers ---------- */
function getChatId(a,b){ return a < b ? `${a}_${b}` : `${b}_${a}`; }
function getFirstName(str){ if(!str) return ""; if(str.includes("@")) return str.split("@")[0]; return str.split(" ")[0]; }
function formatTime(ts){ if(!ts) return ""; const d = new Date(ts); return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function escapeHtml(s){ if(!s) return ""; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

