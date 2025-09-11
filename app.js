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
  update,
  onValue,
  serverTimestamp,
  onChildAdded,
  set,
  get,
  child
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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
const usersTabBtn = document.getElementById("users-tab");
const groupsTabBtn = document.getElementById("groups-tab");
const userListContainer = document.getElementById("user-list");
const groupListContainer = document.getElementById("group-list-container");
const groupListEl = document.getElementById("group-list");
const createGroupBtn = document.getElementById("create-group-btn");
const newGroupNameInput = document.getElementById("new-group-name");
const currentGroupEl = document.getElementById("current-group");

let privateUser = null;
let currentGroupId = null;
let userListenerRefs = [];
let groupMessagesListener = null;
let privateChatListener = null;

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
    console.error(err);
  }
});

loginBtn.addEventListener("click", async () => {
  try {
    const cred = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    await update(ref(db, "users/" + cred.user.uid), {
      email: cred.user.email,
      online: true,
      lastSeen: serverTimestamp()
    });
    loadUsers();
    loadUserGroups();
  } catch (err) {
    alert(err.message);
    console.error(err);
  }
});

logoutBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (user) {
    await update(ref(db, "users/" + user.uid), { online: false, lastSeen: serverTimestamp() });
  }
  signOut(auth);
});

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
    });
    update(ref(db, "users/" + user.uid), {
      email: user.email,
      online: true,
      lastSeen: serverTimestamp()
    }).then(() => {
      loadUsers();
      loadUserGroups();
    });
    loadTypingIndicators();
  } else {
    authSection.style.display = "block";
    chatSection.style.display = "none";
    userListEl.innerHTML = "";
    groupListEl.innerHTML = "";
    privateMessages.innerHTML = "";
    groupMessages.innerHTML = "";
    currentGroupEl.textContent = "None";
    currentGroupId = null;
    privateUser = null;
  }
});

function clearListeners() {
  userListenerRefs.forEach(unsub => unsub && unsub());
  userListenerRefs = [];
  if (groupMessagesListener) groupMessagesListener = null;
  if (privateChatListener) privateChatListener = null;
}

function loadUsers() {
  const usersRef = ref(db, "users");
  const unsubscribe = onValue(usersRef, (snapshot) => {
    userListEl.innerHTML = "";
    let foundOtherUsers = false;
    snapshot.forEach((child) => {
      const user = child.val();
      const uid = child.key;
      if (!user.email || uid === auth.currentUser?.uid) return;
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
  }, (error) => {
    console.error("Error loading users:", error);
    userListEl.innerHTML = "<li>Error loading users.</li>";
  });
  userListenerRefs.push(() => unsubscribe && unsubscribe());
}

usersTabBtn.addEventListener("click", () => {
  usersTabBtn.classList.add("active-tab");
  groupsTabBtn.classList.remove("active-tab");
  userListContainer.style.display = "";
  groupListContainer.style.display = "none";
});

groupsTabBtn.addEventListener("click", () => {
  groupsTabBtn.classList.add("active-tab");
  usersTabBtn.classList.remove("active-tab");
  userListContainer.style.display = "none";
  groupListContainer.style.display = "";
  loadUserGroups();
});

createGroupBtn.addEventListener("click", async () => {
  const name = newGroupNameInput.value.trim();
  if (!name) return alert("Enter group name");
  const user = auth.currentUser;
  if (!user) return;
  const gRef = push(ref(db, "groupChats"));
  const groupId = gRef.key;
  const groupData = {
    name: name,
    creator: user.uid,
    createdAt: Date.now()
  };
  await set(ref(db, "groupChats/" + groupId), groupData);
  await set(ref(db, "groupChats/" + groupId + "/members/" + user.uid), true);
  await set(ref(db, "userGroups/" + user.uid + "/" + groupId), true);
  await set(ref(db, "groupsByCreator/" + user.uid + "/" + groupId), true);
  newGroupNameInput.value = "";
  loadUserGroups();
});

async function joinGroupById(groupIdInput) {
  const code = groupIdInput.trim();
  if (!code) return alert("Enter group ID");
  const user = auth.currentUser;
  if (!user) return;
  const snap = await get(ref(db, "groupChats/" + code));
  if (!snap.exists()) return alert("Group not found");
  await set(ref(db, "groupChats/" + code + "/members/" + user.uid), true);
  await set(ref(db, "userGroups/" + user.uid + "/" + code), true);
  loadUserGroups();
}

async function loadUserGroups() {
  const user = auth.currentUser;
  if (!user) return;
  groupListEl.innerHTML = "";
  const userGroupsRef = ref(db, "userGroups/" + user.uid);
  const snap = await get(userGroupsRef);
  const groupIds = snap.exists() ? Object.keys(snap.val()) : [];
  if (groupIds.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No groups yet. Create one or join by ID.";
    groupListEl.appendChild(li);
    return;
  }
  for (const gid of groupIds) {
    const gSnap = await get(ref(db, "groupChats/" + gid + "/name"));
    const groupName = gSnap.exists() ? gSnap.val() : (await get(ref(db, "groupChats/" + gid))).val()?.name || gid;
    const li = document.createElement("li");
    li.textContent = groupName + " (" + gid.slice(0, 6) + ")";
    li.addEventListener("click", () => {
      loadGroupChat(gid);
      usersTabBtn.classList.remove("active-tab");
      groupsTabBtn.classList.remove("active-tab");
    });
    const joinBtn = document.createElement("button");
    joinBtn.textContent = "Open";
    joinBtn.style.float = "right";
    joinBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      loadGroupChat(gid);
    });
    li.appendChild(joinBtn);
    groupListEl.appendChild(li);
  }
}

groupSend.addEventListener("click", async () => {
  const text = groupInput.value.trim();
  if (!text || !currentGroupId) return;
  const user = auth.currentUser;
  if (!user) return;
  const memberSnap = await get(ref(db, "groupChats/" + currentGroupId + "/members/" + user.uid));
  if (!memberSnap.exists()) return alert("You are not a member of this group.");
  await push(ref(db, "groupChats/" + currentGroupId + "/messages"), {
    senderUid: user.uid,
    senderEmail: user.email,
    text: text,
    ts: Date.now(),
    readBy: {}
  });
  groupInput.value = "";
  const typingRef = ref(db, "groupTyping/" + currentGroupId + "/" + user.uid);
  set(typingRef, false);
});

privateSend.addEventListener("click", async () => {
  const text = privateInput.value.trim();
  if (!text || !privateUser) return;
  const user = auth.currentUser;
  if (!user) return;
  const chatId = getChatId(user.uid, privateUser);
  await push(ref(db, "privateChats/" + chatId), {
    senderUid: user.uid,
    senderEmail: user.email,
    text: text,
    ts: Date.now(),
    read: false
  });
  privateInput.value = "";
  const typingRef = ref(db, "privateTyping/" + chatId + "/" + user.uid);
  set(typingRef, false);
});

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
  if (!user || !currentGroupId) return;
  const typingRef = ref(db, "groupTyping/" + currentGroupId + "/" + user.uid);
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
    Object.keys(data).forEach(gid => {
      const groupData = data[gid] || {};
      Object.keys(groupData).forEach(uid => {
        if (uid !== auth.currentUser?.uid && groupData[uid]) {
          typingUsers.push(uid);
        }
      });
    });
    if (typingUsers.length === 0) {
      typingIndicator.textContent = "";
    } else {
      getUserNamesByUids(typingUsers, (names) => {
        typingIndicator.textContent = names.join(", ") + (names.length > 1 ? " are typing..." : " is typing...");
      });
    }
  });
}

function loadGroupChat(groupId) {
  if (!auth.currentUser) return;
  if (groupMessagesListener) groupMessagesListener = null;
  currentGroupId = groupId;
  currentGroupEl.textContent = "Loading...";
  const memberRef = ref(db, "groupChats/" + groupId + "/members/" + auth.currentUser.uid);
  get(memberRef).then((snap) => {
    if (!snap.exists()) {
      alert("You are not a member of this group. Join first.");
      currentGroupEl.textContent = "None";
      currentGroupId = null;
      return;
    }
    get(ref(db, "groupChats/" + groupId + "/name")).then(gSnap => {
      const gName = gSnap.exists() ? gSnap.val() : (groupId);
      currentGroupEl.textContent = gName;
    });
    const messagesRef = ref(db, "groupChats/" + groupId + "/messages");
    groupMessages.innerHTML = "";
    const unsubscribe = onChildAdded(messagesRef, (snapshot) => {
      const msg = snapshot.val();
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = (msg.senderUid === auth.currentUser.uid) ? "flex-end" : "flex-start";
      const name = document.createElement("span");
      getUserByEmail(msg.senderEmail, (firstName) => {
        name.textContent = firstName;
      });
      name.style.fontSize = "12px";
      name.style.color = "#666";
      name.style.marginBottom = "2px";
      name.style.marginLeft = "6px";
      name.style.marginRight = "6px";
      const div = document.createElement("div");
      div.className = (msg.senderUid === auth.currentUser.uid) ? "message-bubble sender" : "message-bubble receiver";
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
        const readers = msg.readBy ? Object.keys(msg.readBy).filter(uid => uid !== auth.currentUser.uid) : [];
        if (readers.length === 0) {
          status.textContent = "Sent";
        } else {
          getUserNamesByUids(readers, (names) => {
            if (names.length === 1) status.textContent = "Viewed by " + names[0];
            else status.textContent = "Viewed by " + names.slice(0, 2).join(", ") + (names.length > 2 ? " and others" : "");
          });
        }
        wrapper.appendChild(status);
      } else {
        const updateRef = ref(db, "groupChats/" + groupId + "/messages/" + snapshot.key + "/readBy/" + auth.currentUser.uid);
        set(updateRef, true);
      }
      groupMessages.appendChild(wrapper);
      groupMessages.scrollTop = groupMessages.scrollHeight;
    });
    groupMessagesListener = unsubscribe;
  });
}

function loadPrivateChat(otherUid) {
  if (!auth.currentUser) return;
  if (privateChatListener) privateChatListener = null;
  const chatId = getChatId(auth.currentUser.uid, otherUid);
  const chatRef = ref(db, "privateChats/" + chatId);
  privateMessages.innerHTML = "";
  const unsubscribe = onValue(chatRef, (snapshot) => {
    privateMessages.innerHTML = "";
    snapshot.forEach((child) => {
      const msg = child.val();
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = (msg.senderUid === auth.currentUser.uid) ? "flex-end" : "flex-start";
      if (msg.senderUid !== auth.currentUser.uid && !msg.read) {
        update(ref(db, "privateChats/" + chatId + "/" + child.key), { read: true });
      }
      const name = document.createElement("span");
      getUserByEmail(msg.senderEmail, (firstName) => {
        name.textContent = firstName;
      });
      name.style.fontSize = "12px";
      name.style.color = "#666";
      name.style.marginBottom = "2px";
      name.style.marginLeft = "6px";
      name.style.marginRight = "6px";
      const div = document.createElement("div");
      div.className = (msg.senderUid === auth.currentUser.uid) ? "message-bubble sender" : "message-bubble receiver";
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
        status.textContent = msg.read ? "Read" : "Sent";
        wrapper.appendChild(status);
      }
      privateMessages.appendChild(wrapper);
    });
    privateMessages.scrollTop = privateMessages.scrollHeight;
  });
  privateChatListener = unsubscribe;
}

function formatTime(ts) {
  if (!ts) return "";
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + "_" + uid2 : uid2 + "_" + uid1;
}

function getFirstName(str) {
  if (!str) return "";
  if (str.includes("@")) return str.split("@")[0];
  return str.split(" ")[0];
}

function getUserByEmail(email, callback) {
  const usersRef = ref(db, "users");
  get(usersRef).then(snapshot => {
    let firstName = email.split("@")[0];
    snapshot.forEach(child => {
      const user = child.val();
      if (user.email === email && user.fullName) {
        firstName = getFirstName(user.fullName);
      }
    });
    callback(firstName);
  });
}

function getUserNamesByUids(uids, callback) {
  if (!uids || uids.length === 0) return callback([]);
  const usersRef = ref(db, "users");
  get(usersRef).then(snapshot => {
    const names = [];
    snapshot.forEach(child => {
      if (uids.includes(child.key)) {
        names.push(getFirstName(child.val().fullName || child.val().email));
      }
    });
    callback(names);
  });
}
