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
const userNameSpan = document.getElementById("user-name");

const usersTab = document.getElementById("users-tab");
const groupsTab = document.getElementById("groups-tab");
const usersListContainer = document.getElementById("users-list-container");
const groupsListContainer = document.getElementById("groups-list-container");
const userListEl = document.getElementById("user-list");
const groupListEl = document.getElementById("group-list");

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

/* group modal elements (must match index.html) */
const openCreateGroupBtn = document.getElementById("open-create-group");
const groupModal = document.getElementById("group-modal");
const groupNameInput = document.getElementById("modal-group-name");
const friendsListEl = document.getElementById("friends-list");
const groupCreateConfirm = document.getElementById("create-group-confirm");
const groupCreateCancel = document.getElementById("create-group-cancel");

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
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    authSection.style.display = "none";
    chatSection.style.display = "block";

    // ensure user record exists/updates
    const uRef = ref(db, `users/${user.uid}`);
    const snap = await get(uRef);
    if (!snap.exists()) {
      await set(uRef, {
        email: user.email,
        fullName: user.displayName || user.email,
        online: true,
        lastSeen: serverTimestamp()
      });
      userNameSpan.textContent = user.displayName || user.email;
    } else {
      const val = snap.val();
      await update(uRef, { online: true, lastSeen: serverTimestamp() });
      userNameSpan.textContent = val.fullName || val.email || user.email;
    }

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

function loadUsers() {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snap) => {
    console.log("📦 Users snapshot raw:", snap.val());
    userListEl.innerHTML = "";
    const meId = currentUser?.uid;

    // create array of plain objects para safe gamitin sa async loop
    const children = [];
    snap.forEach(child => {
      children.push({ key: child.key, val: child.val() });
    });

    (async () => {
      for (const child of children) {
        const uid = child.key;
        const data = child.val;

        if (!data || uid === meId) continue;

        const li = document.createElement("li");
        li.className = data.online ? "online" : "offline";
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";

        const displayName = data.fullName || data.email || uid;
        const left = document.createElement("div");
        left.innerHTML = `<div>${getFirstName(displayName)} 
          <small style="opacity:.6">
            ${data.online ? "online" : "offline"}
          </small></div>`;
        li.appendChild(left);

        const actions = document.createElement("div");
        actions.className = "friend-actions";

        try {
          const fSnap = await get(ref(db, `friends/${meId}/${uid}`));
          const status = fSnap.exists() ? fSnap.val() : null;

          if (status === true) {
            const msgBtn = document.createElement("button");
            msgBtn.className = "btn small";
            msgBtn.textContent = "Message";
            msgBtn.addEventListener("click", () => openPrivateChat(uid, data));
            actions.appendChild(msgBtn);

            const unfriendBtn = document.createElement("button");
            unfriendBtn.className = "btn small outline";
            unfriendBtn.textContent = "Unfriend";
            unfriendBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              if (!confirm("Remove friend?")) return;
              const updates = {};
              updates[`friends/${meId}/${uid}`] = null;
              updates[`friends/${uid}/${meId}`] = null;
              await update(ref(db), updates);
              loadUsers();
            });
            actions.appendChild(unfriendBtn);

          } else if (status === "pending_sent") {
            const pending = document.createElement("button");
            pending.className = "btn small outline";
            pending.textContent = "Pending";
            pending.disabled = true;
            actions.appendChild(pending);

            const cancel = document.createElement("button");
            cancel.className = "btn small";
            cancel.textContent = "Cancel";
            cancel.addEventListener("click", async (e) => {
              e.stopPropagation();
              if (!confirm("Cancel friend request?")) return;
              const updates = {};
              updates[`friends/${meId}/${uid}`] = null;
              updates[`friends/${uid}/${meId}`] = null;
              await update(ref(db), updates);
              loadUsers();
            });
            actions.appendChild(cancel);

          } else if (status === "pending_incoming") {
            const accept = document.createElement("button");
            accept.className = "btn small primary";
            accept.textContent = "Accept";
            accept.addEventListener("click", async (e) => {
              e.stopPropagation();
              const updates = {};
              updates[`friends/${meId}/${uid}`] = true;
              updates[`friends/${uid}/${meId}`] = true;
              await update(ref(db), updates);
              loadUsers();
            });
            actions.appendChild(accept);

            const decline = document.createElement("button");
            decline.className = "btn small outline";
            decline.textContent = "Decline";
            decline.addEventListener("click", async (e) => {
              e.stopPropagation();
              if (!confirm("Decline friend request?")) return;
              const updates = {};
              updates[`friends/${meId}/${uid}`] = null;
              updates[`friends/${uid}/${meId}`] = null;
              await update(ref(db), updates);
              loadUsers();
            });
            actions.appendChild(decline);

          } else {
            const add = document.createElement("button");
            add.className = "btn small primary";
            add.textContent = "Add Friend";
            add.addEventListener("click", async (e) => {
              e.stopPropagation();
              const updates = {};
              updates[`friends/${meId}/${uid}`] = "pending_sent";
              updates[`friends/${uid}/${meId}`] = "pending_incoming";
              await update(ref(db), updates);
              loadUsers();
            });
            actions.appendChild(add);
          }
        } catch (err) {
          console.error("⚠️ friends check error for", uid, err);
        }

        li.appendChild(actions);
        userListEl.appendChild(li);
      }
    })();
  });
}

/* open private chat only if friends */
function openPrivateChat(otherUid, otherData) {
  selectedPrivateUid = otherUid;
  chattingWith.textContent = getFirstName(otherData.fullName || otherData.email);
  selectedGroupId = null;
  currentGroupEl.textContent = "None";
  privatePanel.style.display = "flex";
  groupPanel.style.display = "none";
  loadPrivateMessages(otherUid);
}

/* ---------- PRIVATE CHAT ---------- */
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

/* ---------- GROUP CREATION MODAL ---------- */
if (openCreateGroupBtn) {
  openCreateGroupBtn.addEventListener("click", async () => {
    groupModal.classList.remove("hidden");
    friendsListEl.innerHTML = "";

    // populate only confirmed friends
    const snap = await get(ref(db, `friends/${currentUser.uid}`));
    if (snap.exists()) {
      const friendsObj = snap.val();
      const friendIds = Object.keys(friendsObj).filter(fid => friendsObj[fid] === true);
      if (friendIds.length === 0) {
        friendsListEl.innerHTML = "<p>No friends to add.</p>";
        return;
      }

      for (const fid of friendIds) {
        const uSnap = await get(ref(db, `users/${fid}`));
        const display = uSnap.exists() ? (uSnap.val().fullName || uSnap.val().email) : fid;
        const row = document.createElement("div");
        row.className = "friend-row";
        row.style.margin = "8px 0";
        row.innerHTML = `<label style="display:flex; align-items:center; gap:8px"><input type="checkbox" value="${fid}"> <span>${getFirstName(display)}</span></label>`;
        friendsListEl.appendChild(row);
      }
    } else {
      friendsListEl.innerHTML = "<p>No friends to add.</p>";
    }
  });
}

if (groupCreateCancel) {
  groupCreateCancel.addEventListener("click", () => {
    groupModal.classList.add("hidden");
  });
}

if (groupCreateConfirm) {
  groupCreateConfirm.addEventListener("click", async () => {
    const name = groupNameInput.value.trim();
    if (!name) return alert("Enter a group name");

    const gRef = push(ref(db, "groupChats"));
    const gid = gRef.key;

    const updates = {};
    updates[`groupChats/${gid}/name`] = name;
    updates[`groupChats/${gid}/creator`] = currentUser.uid;
    updates[`groupChats/${gid}/createdAt`] = Date.now();
    updates[`groupChats/${gid}/members/${currentUser.uid}`] = true;
    updates[`userGroups/${currentUser.uid}/${gid}`] = true;
    updates[`groupsByCreator/${currentUser.uid}/${gid}`] = true;

    const checkboxes = friendsListEl.querySelectorAll("input[type=checkbox]:checked");
    checkboxes.forEach(cb => {
      updates[`groupChats/${gid}/members/${cb.value}`] = true;
      updates[`userGroups/${cb.value}/${gid}`] = true;
    });

    await update(ref(db), updates);

    groupModal.classList.add("hidden");
    groupNameInput.value = "";
    loadUserGroups();
  });
}

/* ---------- GROUPS ---------- */
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

/* ---------- typing across groups ---------- */
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









