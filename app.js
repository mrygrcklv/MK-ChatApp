// app.js - Final complete version with all fixes

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

/* ---------- FIREBASE CONFIG - REPLACE WITH YOURS ---------- */
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
const privateImgInput = document.getElementById("private-img-input");
const privateImageLabel = document.getElementById("private-image-selected-label");
const privateImageName = document.getElementById("private-image-name");
const privateClearImg = document.getElementById("private-clear-img");

const currentGroupEl = document.getElementById("current-group");
const groupMessages = document.getElementById("group-messages");
const groupInput = document.getElementById("group-input");
const groupSend = document.getElementById("group-send");
const groupTyping = document.getElementById("group-typing");
const groupImgInput = document.getElementById("group-img-input");
const groupImageLabel = document.getElementById("group-image-selected-label");
const groupImageName = document.getElementById("group-image-name");
const groupClearImg = document.getElementById("group-clear-img");

const privatePanel = document.getElementById("private-panel");
const groupPanel = document.getElementById("group-panel");

/* group modal elements */
const openCreateGroupBtn = document.getElementById("open-create-group");
const groupModal = document.getElementById("group-modal");
const groupNameInput = document.getElementById("modal-group-name");
const friendsListEl = document.getElementById("friends-list");
const groupCreateConfirm = document.getElementById("create-group-confirm");
const groupCreateCancel = document.getElementById("create-group-cancel");

const joinGroupInput = document.getElementById("join-group-id");
const joinGroupBtn = document.getElementById("join-group-btn");

/* group members modal elements */
const manageMembersBtn = document.getElementById("manage-members-btn");
const membersModal = document.getElementById("members-modal");
const membersCancel = document.getElementById("members-cancel");
const membersListEl = document.getElementById("members-list");
const addMembersListEl = document.getElementById("add-members-list");
const closeMembersModalBtn = document.getElementById("close-members-modal");

/* ---------- state ---------- */
let currentUser = null;
let selectedPrivateUid = null;
let selectedGroupId = null;
let selectedPrivateImage = null;
let selectedGroupImage = null;
let usersListenerAttached = false;
let privateMessageListener = null;
let groupMessageListener = null;
let privateTypingListener = null;
let groupTypingListener = null;
let groupListListener = null;

/* ---------- helpers ---------- */
function getChatId(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}
function getFirstName(s) {
  if (!s) return "";
  if (s.includes("@")) return s.split("@")[0];
  return s.split(" ")[0];
}
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
      lastSeen: serverTimestamp(),
    });
    fullnameInput.value = "";
    emailInput.value = "";
    passwordInput.value = "";
  } catch (err) {
    alert(err.message || "Signup failed");
  }
});

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const pwd = passwordInput.value;
  if (!email || !pwd) return alert("Please provide credentials.");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pwd);
    await update(ref(db, `users/${cred.user.uid}`), {
      online: true,
      lastSeen: serverTimestamp(),
    });
  } catch (err) {
    alert(err.message || "Login failed");
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  await update(ref(db, `users/${currentUser.uid}`), {
    online: false,
    lastSeen: serverTimestamp(),
  });
  await signOut(auth);
});

/* ---------- auth state ---------- */
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    authSection.style.display = "none";
    chatSection.style.display = "block";

    const uRef = ref(db, `users/${user.uid}`);
    const snap = await get(uRef);
    if (!snap.exists()) {
      await set(uRef, {
        email: user.email,
        fullName: user.displayName || user.email,
        online: true,
        lastSeen: serverTimestamp(),
      });
      userNameSpan.textContent = user.displayName || user.email;
    } else {
      const val = snap.val();
      await update(uRef, { online: true, lastSeen: serverTimestamp() });
      userNameSpan.textContent = val.fullName || val.email || user.email;
    }

    if (!usersListenerAttached) {
      loadUsers();
      usersListenerAttached = true;
    }

    loadUserGroups();
    listenGroupTyping();
  } else {
    authSection.style.display = "block";
    chatSection.style.display = "none";
    resetUI();
    usersListenerAttached = false;
  }
});

/* ---------- UI helpers ---------- */
function resetUI() {
  userListEl.innerHTML = "";
  groupListEl.innerHTML = "";
  privateMessages.innerHTML = "";
  groupMessages.innerHTML = "";
  currentGroupEl.textContent = "None";
  chattingWith.textContent = "Nobody";
  selectedGroupId = null;
  selectedPrivateUid = null;
  groupTyping.textContent = "";
  privatePanel.style.display = "none";
  groupPanel.style.display = "none";

  if (privateMessageListener) privateMessageListener();
  if (groupMessageListener) groupMessageListener();
  if (privateTypingListener) privateTypingListener();
  if (groupTypingListener) groupTypingListener();
  if (groupListListener) groupListListener();
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

/* ---------- USERS & FRIENDS ---------- */
function loadUsers() {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snap) => {
    userListEl.innerHTML = "";
    const meId = currentUser?.uid;
    const usersData = [];
    snap.forEach(child => {
      if (child.key !== meId) {
        usersData.push({ key: child.key, val: child.val() });
      }
    });

    (async () => {
      for (const user of usersData) {
        const uid = user.key;
        const data = user.val;

        const li = document.createElement("li");
        li.className = data.online ? "online" : "offline";
        li.style.display = "flex";
        li.style.justifyContent = "space-between";
        li.style.alignItems = "center";

        const displayName = data.fullName || data.email || uid;
        const statusText = data.online ? "online" : "offline";
        const friendStatusRef = ref(db, `friends/${meId}/${uid}`);
        const friendStatusSnap = await get(friendStatusRef);
        const friendStatus = friendStatusSnap.exists() ? friendStatusSnap.val() : null;

        let statusDisplay = `<small style="opacity:.6">${statusText}</small>`;
        if (friendStatus === "pending_incoming") {
          statusDisplay = `<small style="font-weight: bold; color: var(--accent-1);">Added you! 🎉</small>`;
          li.style.background = `linear-gradient(180deg, #f0fff6, #e7fff0)`;
        } else if (friendStatus === "pending_sent") {
          statusDisplay = `<small style="opacity:.6">Pending...</small>`;
        }

        const left = document.createElement("div");
        left.innerHTML = `<div>${getFirstName(displayName)} ${statusDisplay}</div>`;
        li.appendChild(left);

        const actions = document.createElement("div");
        actions.className = "friend-actions";

        if (friendStatus === true) {
          const msgBtn = document.createElement("button");
          msgBtn.className = "btn small";
          msgBtn.textContent = "Message";
          msgBtn.addEventListener("click", () => openPrivateChat(uid, data));
          actions.appendChild(msgBtn);
        } else if (friendStatus === "pending_incoming") {
          const accept = document.createElement("button");
          accept.className = "btn small primary";
          accept.textContent = "Accept";
          accept.addEventListener("click", async (e) => {
            e.stopPropagation();
            const updates = {};
            updates[`friends/${meId}/${uid}`] = true;
            updates[`friends/${uid}/${meId}`] = true;
            await update(ref(db), updates);
          });
          actions.appendChild(accept);

          const decline = document.createElement("button");
          decline.className = "btn small outline";
          decline.textContent = "Decline";
          decline.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm("Deline friend request?")) return;
            const updates = {};
            updates[`friends/${meId}/${uid}`] = null;
            updates[`friends/${uid}/${meId}`] = null;
            await update(ref(db), updates);
          });
          actions.appendChild(decline);
        } else if (friendStatus === "pending_sent") {
          const pending = document.createElement("button");
          pending.className = "btn small outline";
          pending.textContent = "Pending";
          pending.disabled = true;
          actions.appendChild(pending);
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
          });
          actions.appendChild(add);
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

  if (groupMessageListener) groupMessageListener();
  if (privateMessageListener) privateMessageListener();
  if (privateTypingListener) privateTypingListener();
  if (groupTypingListener) groupTypingListener();

  loadPrivateMessages(otherUid);
  listenPrivateTyping(otherUid);
}

/* ---------- PRIVATE MESSAGE (supports image) ---------- */
if (privateImgInput) {
  privateImgInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        selectedPrivateImage = reader.result;
        privateImageName.textContent = file.name;
        privateImageLabel.classList.remove("hidden");
        privateClearImg.style.display = "inline-block";
        checkPrivateSendButtonState();
      };
      reader.readAsDataURL(file);
    }
  });
  privateClearImg.addEventListener("click", () => {
    selectedPrivateImage = null;
    privateImgInput.value = "";
    privateImageLabel.classList.add("hidden");
    privateClearImg.style.display = "none";
    checkPrivateSendButtonState();
  });
}

privateSend.addEventListener("click", async () => {
  const text = privateInput.value.trim();
  const image = selectedPrivateImage;
  if ((!text && !image) || !selectedPrivateUid || !currentUser) return;

  const chatId = getChatId(currentUser.uid, selectedPrivateUid);
  const msgRef = push(ref(db, `privateChats/${chatId}`));

  const messageData = {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    ts: Date.now(),
    read: false
  };
  if (text) messageData.text = text;
  if (image) messageData.image = image;

  await set(msgRef, messageData);
  privateInput.value = "";
  selectedPrivateImage = null;
  if (privateImgInput) privateImgInput.value = "";
  privateImageLabel.classList.add("hidden");
  privateClearImg.style.display = "none";
  checkPrivateSendButtonState();
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), false);
});

privateInput.addEventListener("input", async () => {
  if (!currentUser || !selectedPrivateUid) return;
  const chatId = getChatId(currentUser.uid, selectedPrivateUid);
  const val = (privateInput.value || "").trim() !== "";
  await set(ref(db, `privateTyping/${chatId}/${currentUser.uid}`), val);
  checkPrivateSendButtonState();
});

// New: Listen for Enter key on private message input
privateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    privateSend.click();
  }
});

function checkPrivateSendButtonState() {
  const text = (privateInput.value || "").trim();
  const image = selectedPrivateImage;
  privateSend.disabled = !text && !image;
}

function loadPrivateMessages(otherUid) {
  if (!currentUser) return;
  privateMessages.innerHTML = "";
  const chatId = getChatId(currentUser.uid, otherUid);
  const refChats = ref(db, `privateChats/${chatId}`);
  privateMessageListener = onValue(refChats, (snap) => {
    privateMessages.innerHTML = "";
    snap.forEach((child) => {
      const m = child.val();
      renderPrivateMessage(m, child.key, chatId);
      if (m.senderUid !== currentUser.uid && m.read === false) {
        update(ref(db, `privateChats/${chatId}/${child.key}`), { read: true });
      }
    });
  });
}

function listenPrivateTyping(otherUid) {
  if (!currentUser) return;
  const chatId = getChatId(currentUser.uid, otherUid);
  if (privateTypingListener) privateTypingListener();
  privateTypingListener = onValue(ref(db, `privateTyping/${chatId}`), (snap) => {
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
    privateMessages.scrollTop = privateMessages.scrollHeight;
  });
}

function renderPrivateMessage(msg, key, chatId) {
  const wrapper = document.createElement("div");
  wrapper.className = msg.senderUid === currentUser.uid ? "msg sender" : "msg receiver";

  if (msg.text) {
    const p = document.createElement("div");
    p.textContent = msg.text;
    wrapper.appendChild(p);
  }

  if (msg.image) {
    const img = document.createElement("img");
    img.src = msg.image;
    img.classList.add("chat-image"); // Add the new CSS class
    wrapper.appendChild(img);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const status = msg.senderUid === currentUser.uid ? (msg.read ? " • Read" : " • Sent") : "";
  meta.textContent = `${formatTime(msg.ts)}${status}`;
  wrapper.appendChild(meta);
  privateMessages.appendChild(wrapper);
  privateMessages.scrollTop = privateMessages.scrollHeight;
}

/* ---------- GROUPS (create/join/send/typing) ---------- */

openCreateGroupBtn?.addEventListener("click", async () => {
  groupModal.classList.remove("hidden");
  friendsListEl.innerHTML = "";

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

groupCreateCancel?.addEventListener("click", () => {
  groupModal.classList.add("hidden");
});

groupCreateConfirm?.addEventListener("click", async () => {
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

joinGroupBtn?.addEventListener("click", async () => {
  const gid = joinGroupInput.value.trim();
  if (!gid) return alert("Enter group ID");
  const snap = await get(ref(db, `groupChats/${gid}`));
  if (!snap.exists()) return alert("Group not found");
  await set(ref(db, `groupChats/${gid}/members/${currentUser.uid}`), true);
  await set(ref(db, `userGroups/${currentUser.uid}/${gid}`), true);
  joinGroupInput.value = "";
  loadUserGroups();
});

async function selectGroup(gid, displayName) {
  if (!currentUser) return;
  const memberSnap = await get(ref(db, `groupChats/${gid}/members/${currentUser.uid}`));
  if (!memberSnap.exists()) return alert("You are not a member of that group.");
  selectedGroupId = gid;
  currentGroupEl.textContent = displayName || gid;
  privatePanel.style.display = "none";
  groupPanel.style.display = "flex";

  if (groupMessageListener) groupMessageListener();
  if (privateMessageListener) privateMessageListener();
  if (privateTypingListener) privateTypingListener();
  if (groupTypingListener) groupTypingListener();

  groupMessages.innerHTML = "";
  groupMessageListener = onValue(ref(db, `groupChats/${gid}/messages`), (snap) => {
    groupMessages.innerHTML = "";
    snap.forEach((child) => {
      const m = child.val();
      renderGroupMessage(m, gid, child.key);
      if (m.senderUid !== currentUser.uid) {
        set(ref(db, `groupChats/${gid}/messages/${child.key}/readBy/${currentUser.uid}`), true);
      }
    });
  });
}

/* group image handling */
if (groupImgInput) {
  groupImgInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        selectedGroupImage = reader.result;
        groupImageName.textContent = file.name;
        groupImageLabel.classList.remove("hidden");
        groupClearImg.style.display = "inline-block";
        checkGroupSendButtonState();
      };
      reader.readAsDataURL(file);
    }
  });
  groupClearImg.addEventListener("click", () => {
    selectedGroupImage = null;
    groupImgInput.value = "";
    groupImageLabel.classList.add("hidden");
    groupClearImg.style.display = "none";
    checkGroupSendButtonState();
  });
}

groupSend.addEventListener("click", async () => {
  if (!currentUser || !selectedGroupId) return alert("Select a group first.");
  const text = (groupInput.value || "").trim();
  const image = selectedGroupImage;
  if (!text && !image) return;
  const mem = await get(ref(db, `groupChats/${selectedGroupId}/members/${currentUser.uid}`));
  if (!mem.exists()) return alert("You are not a member of this group.");
  const mRef = push(ref(db, `groupChats/${selectedGroupId}/messages`));

  const messageData = {
    senderUid: currentUser.uid,
    senderEmail: currentUser.email,
    ts: Date.now(),
    readBy: {
      [currentUser.uid]: true
    }
  };
  if (text) messageData.text = text;
  if (image) messageData.image = image;

  await set(mRef, messageData);
  groupInput.value = "";
  selectedGroupImage = null;
  if (groupImgInput) groupImgInput.value = "";
  groupImageLabel.classList.add("hidden");
  groupClearImg.style.display = "none";
  checkGroupSendButtonState();
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), false);
});

groupInput.addEventListener("input", async () => {
  if (!currentUser || !selectedGroupId) return;
  const v = (groupInput.value || "").trim() !== "";
  await set(ref(db, `groupTyping/${selectedGroupId}/${currentUser.uid}`), v);
  checkGroupSendButtonState();
});

// New: Listen for Enter key on group message input
groupInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    groupSend.click();
  }
});

function checkGroupSendButtonState() {
  const text = (groupInput.value || "").trim();
  const image = selectedGroupImage;
  groupSend.disabled = !text && !image;
}

function renderGroupMessage(m, gid, messageKey) {
  const wrapper = document.createElement("div");
  wrapper.className = m.senderUid === currentUser.uid ? "msg sender" : "msg receiver";

  if (m.text) {
    const p = document.createElement("div");
    p.textContent = m.text;
    wrapper.appendChild(p);
  }

  if (m.image) {
    const img = document.createElement("img");
    img.src = m.image;
    img.classList.add("chat-image"); // Add the new CSS class
    wrapper.appendChild(img);
  }

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

/* ---------- GROUP MEMBERS FEATURE ---------- */
manageMembersBtn?.addEventListener("click", () => {
  if (!selectedGroupId) return alert("Select a group first.");
  membersModal.classList.remove("hidden");
  loadGroupMembers(selectedGroupId);
});
membersCancel?.addEventListener("click", () => {
  membersModal.classList.add("hidden");
});

closeMembersModalBtn?.addEventListener("click", () => {
  membersModal.classList.add("hidden");
});

async function loadGroupMembers(gid) {
  membersListEl.innerHTML = "";
  addMembersListEl.innerHTML = "";

  const gSnap = await get(ref(db, `groupChats/${gid}`));
  if (!gSnap.exists()) return;
  const group = gSnap.val();
  const creatorId = group.creator;

  for (const uid of Object.keys(group.members || {})) {
    const uSnap = await get(ref(db, `users/${uid}`));
    const name = uSnap.exists()
      ? uSnap.val().fullName || uSnap.val().email
      : uid;

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.padding = "6px 0";
    row.innerHTML = `<span>${getFirstName(name)}</span>`;

    if (currentUser.uid === creatorId && uid !== creatorId) {
      const rm = document.createElement("button");
      rm.className = "btn small outline";
      rm.textContent = "✕";
      rm.addEventListener("click", async () => {
        if (!confirm(`Remove ${name} from group?`)) return;
        await remove(ref(db, `groupChats/${gid}/members/${uid}`));
        await remove(ref(db, `userGroups/${uid}/${gid}`));
        loadGroupMembers(gid);
      });
      row.appendChild(rm);
    }

    membersListEl.appendChild(row);
  }

  const snap = await get(ref(db, `friends/${currentUser.uid}`));
  if (snap.exists()) {
    const friends = snap.val();
    for (const fid of Object.keys(friends).filter(
      (fid) => friends[fid] === true
    )) {
      if (group.members && group.members[fid]) continue;
      const uSnap = await get(ref(db, `users/${fid}`));
      const fname = uSnap.exists()
        ? uSnap.val().fullName || uSnap.val().email
        : fid;

      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.padding = "6px 0";
      row.innerHTML = `<span>${getFirstName(fname)}</span>`;

      if (currentUser.uid === creatorId) {
        const add = document.createElement("button");
        add.className = "btn small primary";
        add.textContent = "Add";
        add.addEventListener("click", async () => {
          const updates = {};
          updates[`groupChats/${gid}/members/${fid}`] = true;
          updates[`userGroups/${fid}/${gid}`] = true;
          await update(ref(db), updates);
          loadGroupMembers(gid);
        });
        row.appendChild(add);
      }

      addMembersListEl.appendChild(row);
    }
  }
}

/* ---------- group typing watcher ---------- */
function listenGroupTyping() {
  if (groupTypingListener) groupTypingListener();
  groupTypingListener = onValue(ref(db, `groupTyping`), async (snap) => {
    const data = snap.val() || {};
    const typingNames = [];
    for (const gid of Object.keys(data)) {
      const groupTypingObj = data[gid] || {};
      for (const uid of Object.keys(groupTypingObj)) {
        if (groupTypingObj[uid] && uid !== currentUser?.uid && selectedGroupId !== gid) {
           const member = await get(ref(db, `groupChats/${gid}/members/${uid}`));
           if(member.exists()) {
             const uSnap = await get(ref(db, `users/${uid}`));
             if(uSnap.exists()){
               const groupNameSnap = await get(ref(db, `groupChats/${gid}/name`));
               if(groupNameSnap.exists()){
                const name = getFirstName(uSnap.val().fullName || uSnap.val().email);
                typingNames.push(`${name} in ${groupNameSnap.val()}`);
               }
             }
           }
        }
      }
    }
    groupTyping.textContent = typingNames.length ? (typingNames.join(", ") + (typingNames.length > 1 ? " are typing..." : " is typing...")) : "";
  });
}

/* ---------- load user groups on start ---------- */
async function loadUserGroups() {
  if (!currentUser) return;
  groupListEl.innerHTML = "";
  if (groupListListener) groupListListener();
  groupListListener = onValue(ref(db, `userGroups/${currentUser.uid}`), async (snap) => {
    groupListEl.innerHTML = "";
    const ids = snap.exists() ? Object.keys(snap.val()) : [];
    if (ids.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No groups yet. Create one or join one.";
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
  });
}

/* ---------- initial checks for images + send buttons ---------- */
checkPrivateSendButtonState();
checkGroupSendButtonState();

/* ---------- ensure typing cleared when leaving chat (cleanup) ---------- */
window.addEventListener("beforeunload", async () => {
  if (currentUser) {
    await update(ref(db, `users/${currentUser.uid}`), { online: false, lastSeen: Date.now() });
  }
});
