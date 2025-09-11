// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { 
  getDatabase, ref, push, update, onValue, serverTimestamp, set, onDisconnect 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

// Firebase Config
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
const storage = getStorage(app);

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
const groupImageInput = document.getElementById("group-image-input");
const groupImageBtn = document.getElementById("group-image-btn");
const privateImageInput = document.getElementById("private-image-input");
const privateImageBtn = document.getElementById("private-image-btn");

// Group chat creation elements
const createGroupBtn = document.getElementById("create-group-btn");
const createGroupModal = document.getElementById("create-group-modal");
const newGroupNameInput = document.getElementById("new-group-name");
const groupMemberList = document.getElementById("group-member-list");
const submitGroupBtn = document.getElementById("submit-group-btn");
const cancelGroupBtn = document.getElementById("cancel-group-btn");
const groupListEl = document.getElementById("group-list");
const privateConvoListEl = document.getElementById("private-convo-list");
const privateChatSection = document.getElementById("private-chat");
const groupChatSection = document.getElementById("group-chat");
const groupTitleEl = document.getElementById("group-title");
const addContactInput = document.getElementById("add-contact-input");
const addContactBtn = document.getElementById("add-contact-btn");
const pendingListEl = document.getElementById("pending-list");
const sidebarNotification = document.getElementById("sidebar-notification");
const userCodeEl = document.getElementById("user-code");
const contactsListEl = document.getElementById("contacts-list");
const createdGroupsHeaderId = "created-groups-header";
const createdGroupsListId = "created-groups-list";

// Inject Created Groups section if not present
(function ensureCreatedGroupsSection() {
  const sidebar = document.getElementById("user-sidebar");
  if (!sidebar) return;
  if (!document.getElementById(createdGroupsHeaderId)) {
    const h = document.createElement("h3");
    h.id = createdGroupsHeaderId;
    h.style.fontSize = "16px";
    h.style.color = "#388e3c";
    h.style.margin = "12px 0 8px";
    h.textContent = "Created Groups";
    const ul = document.createElement("ul");
    ul.id = createdGroupsListId;
    ul.style.marginBottom = "12px";
    sidebar.insertBefore(ul, sidebar.querySelector("#group-list"));
    sidebar.insertBefore(h, ul);
  }
})();

let privateUser = null;
let currentGroupId = null;
let isCreatingGroup = false;
let groupListListenerAttached = false;

function loadContacts() {
  if (!contactsListEl) return;
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  const contactsRef = ref(db, `contacts/${myUid}`);
  onValue(contactsRef, (snapshot) => {
    contactsListEl.innerHTML = "";
    const ids = [];
    snapshot.forEach((c) => ids.push(c.key));
    if (ids.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No contacts yet.";
      li.classList.add("offline");
      contactsListEl.appendChild(li);
      return;
    }
    ids.forEach((uid) => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.style.padding = "10px 12px";
      li.style.borderRadius = "8px";
      li.style.background = "#e0eafc";
      li.style.color = "#222";
      const nameSpan = document.createElement("div");
      nameSpan.style.fontWeight = "600";
      onValue(ref(db, `users/${uid}`), (uSnap) => {
        const u = uSnap.val() || {};
        nameSpan.textContent = getFirstName(u.fullName || u.email || uid);
      }, { onlyOnce: true });
      li.appendChild(nameSpan);
      li.onclick = () => {
        privateUser = uid;
        chattingWith.textContent = nameSpan.textContent;
        loadPrivateChat(uid);
        showPrivateChat();
      };
      contactsListEl.appendChild(li);
    });
  });
}

// Contacts: add by first 5 chars of UID
if (addContactBtn) {
  addContactBtn.addEventListener("click", async () => {
    const prefix = (addContactInput?.value || "").trim();
    if (!prefix || prefix.length < 5) {
      alert("Enter at least first 5 characters of the user ID.");
      return;
    }
    const myUid = auth.currentUser?.uid;
    if (!myUid) return;

    const usersRef = ref(db, "users");
    onValue(usersRef, async (snapshot) => {
      let matchUid = null;
      snapshot.forEach((child) => {
        const uid = child.key;
        if (uid !== myUid && uid.startsWith(prefix)) {
          matchUid = uid;
        }
      });
      if (!matchUid) {
        alert("No user found with that ID prefix.");
        return;
      }
      // Save contact locally and allow chatting both ways immediately
      await set(ref(db, `contacts/${myUid}/${matchUid}`), true);
      await set(ref(db, `userPrivateChats/${myUid}/${matchUid}`), true);
      await set(ref(db, `userPrivateChats/${matchUid}/${myUid}`), true);
      addContactInput.value = "";
      loadContacts();
      loadPrivateConversationList();
      alert("Contact added.");
    }, { onlyOnce: true });
  });
}

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
      lastSeen: serverTimestamp()
    });
    loadUsers();
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
      lastSeen: serverTimestamp()
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
    await update(ref(db, "users/" + user.uid), { online: false, lastSeen: serverTimestamp() });
  }
  signOut(auth);
});

// ---------------- AUTH STATE ----------------
function repairUserGroupIndex() {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  const groupsRefAll = ref(db, `groupChats`);
  onValue(groupsRefAll, (snapAll) => {
    const fixes = [];
    snapAll.forEach((ch) => {
      const g = ch.val();
      if (g && g.members && g.members[myUid]) {
        fixes.push(set(ref(db, `userGroups/${myUid}/${ch.key}`), true));
      }
    });
    if (fixes.length > 0) {
      Promise.all(fixes).then(() => loadGroupList());
    }
  }, { onlyOnce: true });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    authSection.style.display = "none";
    chatSection.style.display = "block";
    const userRef = ref(db, "users/" + user.uid);
    onValue(userRef, (snapshot) => {
      const userData = snapshot.val();
      if (userData && userData.fullName) {
        userEmail.textContent = getFirstName(userData.fullName);
      } else {
        userEmail.textContent = user.email;
      }
      if (userCodeEl) userCodeEl.textContent = `Your ID code: ${user.uid.substring(0,5)}`;
    });
    
    // Set user online and create presence tracking
    const userStatusRef = ref(db, "users/" + user.uid);
    const isOnlineRef = ref(db, "users/" + user.uid + "/online");
    const lastSeenRef = ref(db, "users/" + user.uid + "/lastSeen");
    
    // Set user online
    update(userStatusRef, {
      email: user.email,
      online: true,
      lastSeen: serverTimestamp()
    }).then(() => loadUsers());

    // Create presence tracking
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        // User is connected
        set(isOnlineRef, true);
        set(lastSeenRef, serverTimestamp());
        
        // Set offline when user disconnects
        onDisconnect(isOnlineRef).set(false);
        onDisconnect(lastSeenRef).set(serverTimestamp());
      }
    });

    loadGroupList();
    loadTypingIndicators();
    loadPrivateConversationList();
    loadPendingList();
    loadContacts();
    repairUserGroupIndex();
    loadCreatedGroups();
  } else {
    authSection.style.display = "block";
    chatSection.style.display = "none";
    userListEl.innerHTML = "";
  }
});

// ---------------- LOAD USERS ----------------
function loadUsers() {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snapshot) => {
    userListEl.innerHTML = "";
    let foundOtherUsers = false;
    const currentUserUid = auth.currentUser?.uid;
    
    snapshot.forEach((child) => {
      const user = child.val();
      const uid = child.key;
      
      // Skip if no email or if it's the current user
      if (!user.email || uid === currentUserUid) return;
      
      foundOtherUsers = true;
      const li = document.createElement("li");
      
      // Create a more detailed user display
      const nameSpan = document.createElement("span");
      nameSpan.textContent = getFirstName(user.fullName || user.email);
      nameSpan.style.fontWeight = "600";
      
      const statusSpan = document.createElement("span");
      statusSpan.style.fontSize = "14px";
      statusSpan.style.marginLeft = "8px";
      
      if (user.online) {
        statusSpan.textContent = "🟢 Online";
        statusSpan.style.color = "#43e97b";
        li.classList.add("online");
      } else {
        // Show last seen time if available
        if (user.lastSeen) {
          const lastSeen = new Date(user.lastSeen);
          const now = new Date();
          const diffMinutes = Math.floor((now - lastSeen) / (1000 * 60));
          
          if (diffMinutes < 60) {
            statusSpan.textContent = `🔴 Offline (${diffMinutes}m ago)`;
          } else if (diffMinutes < 1440) {
            statusSpan.textContent = `🔴 Offline (${Math.floor(diffMinutes / 60)}h ago)`;
          } else {
            statusSpan.textContent = "🔴 Offline";
          }
        } else {
          statusSpan.textContent = "🔴 Offline";
        }
        statusSpan.style.color = "#999";
        li.classList.add("offline");
      }
      
      li.appendChild(nameSpan);
      li.appendChild(statusSpan);
      
      li.addEventListener("click", () => {
        privateUser = uid;
        chattingWith.textContent = getFirstName(user.fullName || user.email);
        privateMessages.innerHTML = "";
        loadPrivateChat(uid);
        showPrivateChat();
      });
      
      userListEl.appendChild(li);
    });
    
    if (!foundOtherUsers) {
      const li = document.createElement("li");
      li.textContent = "No other users found.";
      li.classList.add("offline");
      userListEl.appendChild(li);
    }
  }, (error) => {
    console.error("Error loading users:", error);
    userListEl.innerHTML = "<li>Error loading users.</li>";
  });
}

// ---------------- SEND GROUP MESSAGE ----------------
groupSend.addEventListener("click", async () => {
  const text = groupInput.value.trim();
  if (!text || !currentGroupId) return;
  const user = auth.currentUser;
  if (!user) return;

  await push(ref(db, `groupChats/${currentGroupId}/messages`), {
    sender: user.email,
    text: text,
    ts: Date.now()
  });
  groupInput.value = "";
});

// ---------------- SEND PRIVATE MESSAGE ----------------
privateSend.addEventListener("click", async () => {
  const text = privateInput.value.trim();
  if (!text || !privateUser) return;
  const user = auth.currentUser;
  if (!user) return;

  const chatId = getChatId(user.uid, privateUser);
  await push(ref(db, "privateChats/" + chatId), {
    sender: user.email,
    text: text,
    ts: Date.now(),
    read: false
  });
  privateInput.value = "";

  const typingRef = ref(db, "privateTyping/" + chatId + "/" + user.uid);
  set(typingRef, false);
});

// ---------------- SEND GROUP IMAGE ----------------
groupImageBtn.addEventListener("click", () => groupImageInput.click());

groupImageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !currentGroupId) return;
  const user = auth.currentUser;
  if (!user) return;

  const imgRef = storageRef(storage, `groupImages/${Date.now()}_${file.name}`);
  await uploadBytes(imgRef, file);
  const url = await getDownloadURL(imgRef);

  await push(ref(db, `groupChats/${currentGroupId}/messages`), {
    sender: user.email,
    imageUrl: url,
    ts: Date.now()
  });
  groupImageInput.value = "";
});

// ---------------- SEND PRIVATE IMAGE ----------------
privateImageBtn.addEventListener("click", () => privateImageInput.click());

privateImageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !privateUser) return;
  const user = auth.currentUser;
  if (!user) return;

  const chatId = getChatId(user.uid, privateUser);
  const imgRef = storageRef(storage, `privateImages/${chatId}/${Date.now()}_${file.name}`);
  await uploadBytes(imgRef, file);
  const url = await getDownloadURL(imgRef);

  await push(ref(db, "privateChats/" + chatId), {
    sender: user.email,
    imageUrl: url,
    ts: Date.now(),
    read: false
  });
  privateImageInput.value = "";
});

// ---------------- GROUP CHAT ----------------
function loadGroupMessages(groupId) {
  const groupRef = ref(db, `groupChats/${groupId}/messages`);
  groupMessages.innerHTML = "";
  onValue(groupRef, (snapshot) => {
    groupMessages.innerHTML = "";
    snapshot.forEach((child) => {
      const msg = child.val();
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = (msg.sender === auth.currentUser.email) ? "flex-end" : "flex-start";

      const name = document.createElement("span");
      getUserByEmail(msg.sender, (firstName) => {
        name.textContent = firstName;
      });
      name.style.fontSize = "12px";
      name.style.color = "#666";
      name.style.marginBottom = "2px";
      name.style.marginLeft = "6px";
      name.style.marginRight = "6px";

      let div;
      if (msg.imageUrl) {
        div = renderImageMessage(msg.imageUrl);
      } else {
        div = document.createElement("div");
        div.className = (msg.sender === auth.currentUser.email) ? "message-bubble sender" : "message-bubble receiver";
        div.textContent = msg.text;
      }

      const time = document.createElement("span");
      time.className = "message-timestamp";
      time.textContent = formatTime(msg.ts);

      wrapper.appendChild(name);
      wrapper.appendChild(div);
      wrapper.appendChild(time);

      groupMessages.appendChild(wrapper);
      groupMessages.scrollTop = groupMessages.scrollHeight;
    });
  });
}

// ---------------- TYPING INDICATORS ----------------
privateInput.addEventListener("input", () => {
  const user = auth.currentUser;
  if (!user || !privateUser) return;

  const chatId = getChatId(user.uid, privateUser);
  const typingRef = ref(db, "privateTyping/" + chatId + "/" + user.uid);

  if (privateInput.value.trim() !== "") {
    set(typingRef, true);
  } else {
    set(typingRef, false);
  }
});

groupInput.addEventListener("input", () => {
  const user = auth.currentUser;
  if (!user) return;
  const typingRef = ref(db, "groupTyping/" + user.uid);
  if (groupInput.value.trim() !== "") {
    set(typingRef, true);
  } else {
    set(typingRef, false);
  }
});

function loadTypingIndicators() {
  const typingRef = ref(db, "groupTyping");
  onValue(typingRef, (snapshot) => {
    const data = snapshot.val() || {};
    const typingUsers = [];
    Object.keys(data).forEach(uid => {
      if (uid !== auth.currentUser?.uid && data[uid]) {
        getUserNamesByUids([uid], (names) => {
          if (names.length > 0) {
            typingUsers.push(names[0]);
            typingIndicator.textContent = typingUsers.join(", ") + (typingUsers.length > 1 ? " are typing..." : " is typing...");
          }
        });
      }
    });
    if (typingUsers.length === 0) {
      typingIndicator.textContent = "";
    }
  });
}

// ---------------- PRIVATE CHAT ----------------
function loadPrivateChat(otherUid) {
  const chatId = getChatId(auth.currentUser.uid, otherUid);
  const chatRef = ref(db, "privateChats/" + chatId);

  // Load messages
  onValue(chatRef, (snapshot) => {
    privateMessages.innerHTML = "";
    snapshot.forEach((child) => {
      const msg = child.val();
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = (msg.sender === auth.currentUser.email) ? "flex-end" : "flex-start";

      const msgRef = ref(db, "privateChats/" + chatId + "/" + child.key);
      if (msg.sender !== auth.currentUser.email && !msg.read) {
        update(msgRef, { read: true });
      }

      const name = document.createElement("span");
      getUserByEmail(msg.sender, (firstName) => {
        name.textContent = firstName;
      });
      name.style.fontSize = "12px";
      name.style.color = "#666";
      name.style.marginBottom = "2px";
      name.style.marginLeft = "6px";
      name.style.marginRight = "6px";

      let div;
      if (msg.imageUrl) {
        div = renderImageMessage(msg.imageUrl);
      } else {
        div = document.createElement("div");
        div.className = (msg.sender === auth.currentUser.email) ? "message-bubble sender" : "message-bubble receiver";
        div.textContent = msg.text;
      }

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
    });
    privateMessages.scrollTop = privateMessages.scrollHeight;
  });

  // Typing indicator listener
  const typingRef = ref(db, "privateTyping/" + chatId);
  onValue(typingRef, (snapshot) => {
    const data = snapshot.val() || {};
    const typingUsers = Object.keys(data).filter(
      uid => uid !== auth.currentUser.uid && data[uid]
    );

    // Remove old indicator if any
    const existing = privateMessages.querySelector(".typing-indicator");
    if (existing) existing.remove();

    if (typingUsers.length > 0) {
      getUserNamesByUids(typingUsers, (names) => {
        const indicator = document.createElement("div");
        indicator.className = "typing-indicator";
        indicator.textContent = names[0] + " is typing...";
        privateMessages.appendChild(indicator);
        privateMessages.scrollTop = privateMessages.scrollHeight;
      });
    }
  });
}

// ---------------- CREATE GROUP ----------------
createGroupBtn.addEventListener("click", () => {
  createGroupModal.style.display = "flex";
  renderMemberSelection();
});

cancelGroupBtn.addEventListener("click", () => {
  createGroupModal.style.display = "none";
  newGroupNameInput.value = "";
});

function renderMemberSelection() {
  groupMemberList.innerHTML = "<strong>Add members:</strong><br>";
  const usersRef = ref(db, "users");
  onValue(usersRef, (snapshot) => {
    snapshot.forEach((child) => {
      const user = child.val();
      const uid = child.key;
      if (!user.email) return;
      if (uid === auth.currentUser?.uid) return; // exclude self from selection
      const label = document.createElement("label");
      label.style.display = "block";
      label.style.marginBottom = "6px";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = uid;
      checkbox.style.marginRight = "8px";
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(getFirstName(user.fullName || user.email)));
      groupMemberList.appendChild(label);
    });
  }, { onlyOnce: true });
}

submitGroupBtn.addEventListener("click", async () => {
  if (isCreatingGroup) return;
  isCreatingGroup = true;
  const name = newGroupNameInput.value.trim();
  if (!name) { alert("Enter a group name."); isCreatingGroup = false; return; }
  const memberCheckboxes = groupMemberList.querySelectorAll("input[type=checkbox]:checked");
  const members = {};
  memberCheckboxes.forEach(cb => members[cb.value] = true);
  members[auth.currentUser.uid] = true; // Always include self

  try {
    // Step 1: create group
    const groupRef = push(ref(db, "groupChats"));
    await set(groupRef, {
      name,
      members,
      messages: {},
      createdAt: Date.now()
    });

    // Step 2: best-effort index writes
    const memberUids = Object.keys(members);
    try {
      await Promise.all(memberUids.map(uid => set(ref(db, `userGroups/${uid}/${groupRef.key}`), true)));
    } catch (indexErr) {
      console.warn("userGroups index write failed (non-blocking):", indexErr?.message || indexErr);
    }

    createGroupModal.style.display = "none";
    newGroupNameInput.value = "";
    currentGroupId = groupRef.key;
    if (groupTitleEl) groupTitleEl.textContent = name;
    loadGroupMessages(currentGroupId);
    loadGroupList();
  } catch (err) {
    console.error("Create group error (groupChats write):", err?.code || err?.name, err?.message || err);
    alert("Failed to create group: " + (err?.message || err));
  } finally {
    isCreatingGroup = false;
  }
});

function loadGroupList() {
  if (groupListListenerAttached) return;
  groupListListenerAttached = true;
  groupListEl.innerHTML = "";
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  const myGroupsRef = ref(db, `userGroups/${myUid}`);
  onValue(myGroupsRef, (snapshot) => {
    groupListEl.innerHTML = "";
    const groupIds = [];
    snapshot.forEach((child) => groupIds.push(child.key));

    if (groupIds.length === 0) {
      const groupsRefAll = ref(db, `groupChats`);
      onValue(groupsRefAll, (snapAll) => {
        const ids = [];
        snapAll.forEach((ch) => {
          const g = ch.val();
          if (g && g.members && g.members[myUid]) ids.push(ch.key);
        });
        renderGroupListByIds(ids);
      }, { onlyOnce: true });
      return;
    }

    renderGroupListByIds(groupIds);
  });
}

function renderGroupListByIds(ids) {
  let firstGroupId = null;
  ids.forEach((groupId) => {
    const groupRef = ref(db, `groupChats/${groupId}`);
    onValue(groupRef, (groupSnap) => {
      const group = groupSnap.val();
      if (!group) return;
      if (!firstGroupId) firstGroupId = groupId;
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.style.padding = "10px 12px";
      li.style.borderRadius = "8px";
      li.style.background = currentGroupId === groupId ? "#4f8cff" : "#e0eafc";
      li.style.color = currentGroupId === groupId ? "#fff" : "#222";
      li.style.marginBottom = "8px";

      const nameDiv = document.createElement("div");
      nameDiv.style.fontWeight = "600";
      nameDiv.textContent = group.name || "Group";
      const previewDiv = document.createElement("div");
      previewDiv.style.fontSize = "13px";
      previewDiv.style.opacity = "0.8";

      const msgsRef = ref(db, `groupChats/${groupId}/messages`);
      onValue(msgsRef, (s) => {
        let last = "";
        let lastTs = 0;
        s.forEach((m) => {
          const mv = m.val();
          if (mv && mv.ts && mv.ts > lastTs) {
            lastTs = mv.ts;
            last = mv.imageUrl ? "📷 Image" : (mv.text || "");
          }
        });
        previewDiv.textContent = last;
      });

      li.onclick = () => {
        currentGroupId = groupId;
        if (groupTitleEl) groupTitleEl.textContent = nameDiv.textContent;
        loadGroupMessages(groupId);
        showGroupChat();
      };

      li.appendChild(nameDiv);
      li.appendChild(previewDiv);
      groupListEl.appendChild(li);

      if (!currentGroupId && firstGroupId) {
        currentGroupId = firstGroupId;
        if (groupTitleEl) groupTitleEl.textContent = nameDiv.textContent;
        loadGroupMessages(currentGroupId);
      }
    }, { onlyOnce: true });
  });
}

function loadPrivateConversationList() {
  if (!privateConvoListEl) return;
  privateConvoListEl.innerHTML = "";
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  const indexRef = ref(db, `userPrivateChats/${myUid}`);
  onValue(indexRef, (snapshot) => {
    privateConvoListEl.innerHTML = "";
    const uids = [];
    snapshot.forEach((child) => uids.push(child.key));

    if (uids.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No private conversations yet.";
      li.classList.add("offline");
      privateConvoListEl.appendChild(li);
      return;
    }

    uids.forEach((otherUid) => {
      const li = document.createElement("li");
      li.style.cursor = "pointer";
      li.style.padding = "10px 12px";
      li.style.borderRadius = "8px";
      li.style.background = otherUid === privateUser ? "#4f8cff" : "#e0eafc";
      li.style.color = otherUid === privateUser ? "#fff" : "#222";

      const nameSpan = document.createElement("div");
      nameSpan.style.fontWeight = "600";
      const previewSpan = document.createElement("div");
      previewSpan.style.fontSize = "13px";
      previewSpan.style.opacity = "0.8";

      const userRef = ref(db, "users/" + otherUid);
      onValue(userRef, (userSnap) => {
        const u = userSnap.val() || {};
        nameSpan.textContent = getFirstName(u.fullName || u.email || otherUid);
      }, { onlyOnce: true });

      const convChatId = getChatId(auth.currentUser.uid, otherUid);
      const lastMsgRef = ref(db, "privateChats/" + convChatId);
      onValue(lastMsgRef, (snap) => {
        let lastText = "";
        let lastTs = 0;
        snap.forEach((c) => {
          const v = c.val();
          if (v && v.ts && v.ts > lastTs) {
            lastTs = v.ts;
            lastText = v.imageUrl ? "📷 Image" : (v.text || "");
          }
        });
        previewSpan.textContent = lastText;
      });

      li.onclick = () => {
        privateUser = otherUid;
        chattingWith.textContent = nameSpan.textContent;
        loadPrivateChat(otherUid);
        showPrivateChat();
        loadPrivateConversationList();
      };
      li.appendChild(nameSpan);
      li.appendChild(previewSpan);
      privateConvoListEl.appendChild(li);
    });
  });
}

function loadPendingList() {
  if (!pendingListEl) return;
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  const pendingRef = ref(db, `pendingMessages/${myUid}`);
  onValue(pendingRef, (snapshot) => {
    pendingListEl.innerHTML = "";
    const senders = [];
    snapshot.forEach((senderSnap) => {
      const fromUid = senderSnap.key;
      senders.push(fromUid);
      const li = document.createElement("li");
      li.style.display = "flex";
      li.style.justifyContent = "space-between";
      li.style.alignItems = "center";
      const nameDiv = document.createElement("div");
      onValue(ref(db, "users/" + fromUid), (uSnap) => {
        const u = uSnap.val() || {};
        nameDiv.textContent = getFirstName(u.fullName || u.email || fromUid);
      }, { onlyOnce: true });

      const btns = document.createElement("div");
      const acceptBtn = document.createElement("button");
      acceptBtn.textContent = "Accept";
      acceptBtn.style.marginRight = "6px";
      acceptBtn.onclick = () => acceptPending(fromUid);
      const declineBtn = document.createElement("button");
      declineBtn.textContent = "Decline";
      declineBtn.className = "decline";
      declineBtn.onclick = () => declinePending(fromUid);
      btns.appendChild(acceptBtn);
      btns.appendChild(declineBtn);

      li.appendChild(nameDiv);
      li.appendChild(btns);
      pendingListEl.appendChild(li);
    });

    if (sidebarNotification) {
      if (senders.length > 0) {
        sidebarNotification.style.display = "block";
        sidebarNotification.textContent = `${senders.length} pending message${senders.length>1?'s':''}.`;
      } else {
        sidebarNotification.style.display = "none";
        sidebarNotification.textContent = "";
      }
    }
  });
}

async function acceptPending(fromUid) {
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  // allow chatting both ways
  await set(ref(db, `userPrivateChats/${myUid}/${fromUid}`), true);
  await set(ref(db, `userPrivateChats/${fromUid}/${myUid}`), true);
  await set(ref(db, `contacts/${myUid}/${fromUid}`), true);

  // move pending messages into private chat
  const chatId = getChatId(myUid, fromUid);
  onValue(ref(db, `pendingMessages/${myUid}/${fromUid}`), async (snap) => {
    const promises = [];
    snap.forEach((msgSnap) => {
      const v = msgSnap.val();
      promises.push(push(ref(db, `privateChats/${chatId}`), v));
    });
    await Promise.all(promises);
    // clear pending for that sender
    await set(ref(db, `pendingMessages/${myUid}/${fromUid}`), null);
    loadPendingList();
    loadPrivateConversationList();
    privateUser = fromUid;
    loadPrivateChat(fromUid);
    showPrivateChat();
  }, { onlyOnce: true });
}

function declinePending(fromUid) {
  // keep in pending; optionally could mark a status; for now do nothing
  alert("Declined. The conversation will remain in Pending Messages.");
}

function showPrivateChat() {
  if (privateChatSection) privateChatSection.style.display = "block";
  if (groupChatSection) groupChatSection.style.display = "none";
}

function showGroupChat() {
  if (privateChatSection) privateChatSection.style.display = "none";
  if (groupChatSection) groupChatSection.style.display = "block";
}

// ---------------- FORMAT TIMESTAMP ----------------
function formatTime(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

// Helper: Find user by email and get first name (async)
function getUserByEmail(email, callback) {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snapshot) => {
    let firstName = email.split("@")[0];
    snapshot.forEach((child) => {
      const user = child.val();
      if (user.email === email && user.fullName) {
        firstName = getFirstName(user.fullName);
      }
    });
    callback(firstName);
  }, { onlyOnce: true });
}

function getUserNamesByUids(uids, callback) {
  const usersRef = ref(db, "users");
  onValue(usersRef, (snapshot) => {
    const names = [];
    snapshot.forEach((child) => {
      if (uids.includes(child.key)) {
        names.push(getFirstName(child.val().fullName || child.val().email));
      }
    });
    callback(names);
  }, { onlyOnce: true });
}

// ---------------- RENDER IMAGE MESSAGE ----------------
function renderImageMessage(url) {
  const img = document.createElement("img");
  img.src = url;
  img.alt = "Shared image";
  img.style.maxWidth = "180px";
  img.style.borderRadius = "10px";
  img.style.marginBottom = "4px";
  img.style.display = "block";

  const saveBtn = document.createElement("a");
  saveBtn.href = url;
  saveBtn.download = "";
  saveBtn.textContent = "Save";
  saveBtn.style.display = "inline-block";
  saveBtn.style.marginTop = "2px";
  saveBtn.style.fontSize = "13px";
  saveBtn.style.color = "#388e3c";
  saveBtn.style.textDecoration = "underline";
  saveBtn.style.cursor = "pointer";

  const wrapper = document.createElement("div");
  wrapper.appendChild(img);
  wrapper.appendChild(saveBtn);
  return wrapper;
}

function loadCreatedGroups() {
  const list = document.getElementById(createdGroupsListId);
  if (!list) return;
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;
  const idxRef = ref(db, `groupsByCreator/${myUid}`);
  onValue(idxRef, (snapshot) => {
    list.innerHTML = "";
    const indexedIds = [];
    snapshot.forEach((c) => indexedIds.push(c.key));

    const renderIds = (ids) => {
      list.innerHTML = "";
      if (ids.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No created groups yet.";
        li.classList.add("offline");
        list.appendChild(li);
        return;
      }
      ids.forEach((groupId) => {
        const groupRef = ref(db, `groupChats/${groupId}`);
        onValue(groupRef, (gs) => {
          const g = gs.val();
          if (!g) return;
          const li = document.createElement("li");
          li.textContent = g.name || groupId;
          li.style.cursor = "pointer";
          li.onclick = () => {
            currentGroupId = groupId;
            if (groupTitleEl) groupTitleEl.textContent = g.name || groupId;
            loadGroupMessages(groupId);
            showGroupChat();
          };
          list.appendChild(li);
        }, { onlyOnce: true });
      });
    };

    if (indexedIds.length > 0) {
      renderIds(indexedIds);
      return;
    }

    // Fallback: scan all groups by creatorUid and repair index
    const groupsRefAll = ref(db, `groupChats`);
    onValue(groupsRefAll, (snapAll) => {
      const mine = [];
      const repairs = [];
      snapAll.forEach((ch) => {
        const g = ch.val();
        if (g && g.creatorUid === myUid) {
          mine.push(ch.key);
          repairs.push(set(ref(db, `groupsByCreator/${myUid}/${ch.key}`), true));
        }
      });
      if (repairs.length > 0) {
        Promise.all(repairs).catch(() => {/* ignore */});
      }
      renderIds(mine);
    }, { onlyOnce: true });
  });
}
