// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase, ref, set, get, onChildAdded, push, update, onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Firebase config
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
const auth = getAuth();
const db = getDatabase(app);

let currentUser = null;
let currentChatUser = null;
let currentGroupId = null;

// Auth
document.getElementById("signup-btn").onclick = async () => {
  const fullname = document.getElementById("fullname").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await set(ref(db, "users/" + userCred.user.uid), { fullname, email });
};

document.getElementById("login-btn").onclick = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  await signInWithEmailAndPassword(auth, email, password);
};

document.getElementById("logout-btn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("chat-section").style.display = "block";
    document.getElementById("user-email").innerText = user.email;
    loadUsers();
    loadGroups();
  } else {
    currentUser = null;
    document.getElementById("auth-section").style.display = "block";
    document.getElementById("chat-section").style.display = "none";
  }
});

// Sidebar tabs
document.getElementById("users-tab").onclick = () => {
  document.getElementById("user-list").classList.remove("hidden");
  document.getElementById("groups-section").classList.add("hidden");
  document.getElementById("users-tab").classList.add("active-tab");
  document.getElementById("groups-tab").classList.remove("active-tab");
};
document.getElementById("groups-tab").onclick = () => {
  document.getElementById("user-list").classList.add("hidden");
  document.getElementById("groups-section").classList.remove("hidden");
  document.getElementById("groups-tab").classList.add("active-tab");
  document.getElementById("users-tab").classList.remove("active-tab");
};

// Load Users
function loadUsers() {
  const ul = document.getElementById("user-list");
  ul.innerHTML = "";
  const usersRef = ref(db, "users");
  onChildAdded(usersRef, (snap) => {
    if (snap.key !== currentUser.uid) {
      const li = document.createElement("li");
      li.innerText = snap.val().fullname;
      li.onclick = () => openPrivateChat(snap.key, snap.val().fullname);
      ul.appendChild(li);
    }
  });
}

// Private Chat
function getChatId(uid1, uid2) {
  return uid1 < uid2 ? uid1 + "_" + uid2 : uid2 + "_" + uid1;
}

function openPrivateChat(uid, name) {
  currentChatUser = uid;
  document.getElementById("chatting-with").innerText = name;
  const chatId = getChatId(currentUser.uid, uid);
  const msgRef = ref(db, "privateChats/" + chatId + "/messages");
  document.getElementById("private-messages").innerHTML = "";
  onChildAdded(msgRef, (snap) => renderPrivateMessage(snap.val(), snap.key, chatId, name));
}

document.getElementById("private-send").onclick = () => {
  const input = document.getElementById("private-input");
  if (!input.value) return;
  const chatId = getChatId(currentUser.uid, currentChatUser);
  push(ref(db, "privateChats/" + chatId + "/messages"), {
    from: currentUser.uid,
    text: input.value,
    timestamp: Date.now(),
    isRead: false
  });
  input.value = "";
};

// Render private messages + real-time receipts
function renderPrivateMessage(msg, key, chatId, name) {
  const div = document.createElement("div");
  div.className = "message-bubble " + (msg.from === currentUser.uid ? "sender" : "receiver");
  div.innerHTML = msg.text + 
    `<div class="message-timestamp">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
     ${msg.from === currentUser.uid ? `<span class="message-status">${msg.isRead ? "Seen" : "Sent"}</span>` : ""}</div>`;
  document.getElementById("private-messages").appendChild(div);

  if (msg.from !== currentUser.uid && !msg.isRead) {
    update(ref(db, "privateChats/" + chatId + "/messages/" + key), { isRead: true });
  }

  // Real-time update for status
  onValue(ref(db, "privateChats/" + chatId + "/messages/" + key + "/isRead"), (snap) => {
    if (msg.from === currentUser.uid) {
      div.querySelector(".message-status").innerText = snap.val() ? "Seen" : "Sent";
    }
  });
}

// Typing indicator (Private)
const privateInput = document.getElementById("private-input");
privateInput.addEventListener("input", () => {
  const chatId = getChatId(currentUser.uid, currentChatUser);
  update(ref(db, "privateTyping/" + chatId), { [currentUser.uid]: privateInput.value.length > 0 });
});
function listenTypingPrivate(chatId, name) {
  onValue(ref(db, "privateTyping/" + chatId), (snap) => {
    const typingData = snap.val() || {};
    const typingDiv = document.getElementById("private-typing");
    typingDiv.innerText = "";
    Object.keys(typingData).forEach(uid => {
      if (uid !== currentUser.uid && typingData[uid]) {
        typingDiv.innerText = `${name} is typing...`;
      }
    });
  });
}

// Groups
document.getElementById("create-group-btn").onclick = () => {
  const name = document.getElementById("new-group-name").value;
  if (!name) return;
  const groupRef = push(ref(db, "groupChats"), {
    name,
    members: { [currentUser.uid]: true }
  });
  update(ref(db, "userGroups/" + currentUser.uid + "/" + groupRef.key), true);
  update(ref(db, "groupsByCreator/" + currentUser.uid + "/" + groupRef.key), true);
  document.getElementById("new-group-name").value = "";
};

function loadGroups() {
  const ul = document.getElementById("group-list");
  ul.innerHTML = "";
  const groupsRef = ref(db, "groupChats");
  onChildAdded(groupsRef, (snap) => {
    const data = snap.val();
    if (data.members && data.members[currentUser.uid]) {
      const li = document.createElement("li");
      li.innerText = data.name;
      li.onclick = () => openGroupChat(snap.key, data.name);
      ul.appendChild(li);
    }
  });
}

function openGroupChat(groupId, name) {
  currentGroupId = groupId;
  document.getElementById("current-group").innerText = name;
  const msgRef = ref(db, "groupChats/" + groupId + "/messages");
  document.getElementById("group-messages").innerHTML = "";
  onChildAdded(msgRef, (snap) => renderGroupMessage(snap.val(), snap.key, groupId));
}

document.getElementById("group-send").onclick = () => {
  if (!currentGroupId) return;
  const input = document.getElementById("group-input");
  if (!input.value) return;
  push(ref(db, "groupChats/" + currentGroupId + "/messages"), {
    from: currentUser.uid,
    text: input.value,
    timestamp: Date.now(),
    seenBy: { [currentUser.uid]: true }
  });
  input.value = "";
};

function renderGroupMessage(msg, key, groupId) {
  const div = document.createElement("div");
  div.className = "message-bubble " + (msg.from === currentUser.uid ? "sender" : "receiver");
  div.innerHTML = msg.text + 
    `<div class="message-timestamp">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
     ${msg.from === currentUser.uid ? `<span class="message-status" id="status-${key}"></span>` : ""}</div>`;
  document.getElementById("group-messages").appendChild(div);

  // Mark as seen if current user receives it
  if (msg.from !== currentUser.uid) {
    update(ref(db, "groupChats/" + groupId + "/messages/" + key + "/seenBy"), {
      [currentUser.uid]: true
    });
  }

  // Real-time receipt updates
  onValue(ref(db, "groupChats/" + groupId + "/messages/" + key + "/seenBy"), (snap) => {
    if (msg.from === currentUser.uid) {
      const seenBy = snap.val() || {};
      const membersRef = ref(db, "groupChats/" + groupId + "/members");
      get(membersRef).then((membersSnap) => {
        const members = membersSnap.val() || {};
        const memberCount = Object.keys(members).length;
        const seenUsers = Object.keys(seenBy).filter(uid => uid !== currentUser.uid);
        const statusEl = document.getElementById("status-" + key);

        if (seenUsers.length === 0) {
          statusEl.innerText = "Sent";
        } else if (seenUsers.length === memberCount - 1) {
          statusEl.innerText = "Viewed by Everyone";
        } else {
          // Get first viewer's name
          const firstViewer = seenUsers[0];
          get(ref(db, "users/" + firstViewer)).then((userSnap) => {
            const viewerName = userSnap.val()?.fullname || "Someone";
            statusEl.innerText = "Viewed by " + viewerName;
          });
        }
      });
    }
  });
}

// Typing indicator (Group)
const groupInput = document.getElementById("group-input");
groupInput.addEventListener("input", () => {
  if (!currentGroupId) return;
  update(ref(db, "groupTyping/" + currentGroupId + "/" + currentUser.uid), groupInput.value.length > 0);
});
function listenTypingGroup(groupId) {
  const typingDiv = document.getElementById("group-typing");
  onValue(ref(db, "groupTyping/" + groupId), (snap) => {
    const typingData = snap.val() || {};
    typingDiv.innerText = "";
    Object.keys(typingData).forEach(uid => {
      if (uid !== currentUser.uid && typingData[uid]) {
        get(ref(db, "users/" + uid)).then((userSnap) => {
          typingDiv.innerText = `${userSnap.val().fullname} is typing...`;
        });
      }
    });
  });
}

// Hook listeners on chat open
function openPrivateChat(uid, name) {
  currentChatUser = uid;
  document.getElementById("chatting-with").innerText = name;
  const chatId = getChatId(currentUser.uid, uid);
  const msgRef = ref(db, "privateChats/" + chatId + "/messages");
  document.getElementById("private-messages").innerHTML = "";
  onChildAdded(msgRef, (snap) => renderPrivateMessage(snap.val(), snap.key, chatId, name));
  listenTypingPrivate(chatId, name);
}

function openGroupChat(groupId, name) {
  currentGroupId = groupId;
  document.getElementById("current-group").innerText = name;
  const msgRef = ref(db, "groupChats/" + groupId + "/messages");
  document.getElementById("group-messages").innerHTML = "";
  onChildAdded(msgRef, (snap) => renderGroupMessage(snap.val(), snap.key, groupId));
  listenTypingGroup(groupId);
}
