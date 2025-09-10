// Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { 
  getDatabase, ref, push, update, onValue, serverTimestamp, onChildAdded, set 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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
    }).then(() => loadUsers());

    loadGroupMessages();
    loadTypingIndicators();
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
}

// ---------------- SEND GROUP MESSAGE ----------------
groupSend.addEventListener("click", async () => {
  const text = groupInput.value.trim();
  if (!text) return;
  const user = auth.currentUser;
  if (!user) return;

  await push(ref(db, "groupMessages"), {
    sender: user.email,
    text: text,
    ts: Date.now(),
    readBy: {}
  });
  groupInput.value = "";

  const typingRef = ref(db, "groupTyping/" + user.uid);
  set(typingRef, false);
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
});

// ---------------- GROUP CHAT ----------------
function loadGroupMessages() {
  const groupRef = ref(db, "groupMessages");
  groupMessages.innerHTML = "";

  onChildAdded(groupRef, (snapshot) => {
    const msg = snapshot.val();
    const msgKey = snapshot.key;
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = (msg.sender === auth.currentUser.email) ? "flex-end" : "flex-start";

    const user = auth.currentUser;
    if (user && (!msg.readBy || !msg.readBy[user.uid])) {
      const msgRef = ref(db, "groupMessages/" + msgKey + "/readBy");
      update(msgRef, { [user.uid]: true });
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

      if (!msg.readBy) {
        status.textContent = "Sent";
      } else {
        const readers = Object.keys(msg.readBy).filter(uid => uid !== auth.currentUser.uid);

        if (readers.length === 0) {
          status.textContent = "Sent";
        } else {
          getUserNamesByUids(readers, (names) => {
            const totalUsers = userListEl.querySelectorAll("li").length;
            if (names.length === totalUsers) {
              status.textContent = "Viewed by everyone";
            } else if (names.length === 1) {
              status.textContent = "Viewed by " + names[0];
            } else if (names.length <= 3) {
              status.textContent = "Viewed by " + names.join(", ");
            } else {
              status.textContent = "Viewed by " + names.slice(0, 2).join(", ") + " and " + (names.length - 2) + " others";
            }
          });
        }
      }
      wrapper.appendChild(status);
    }

    groupMessages.appendChild(wrapper);
    groupMessages.scrollTop = groupMessages.scrollHeight;
  });
}

// ---------------- TYPING INDICATORS ----------------
privateInput.addEventListener("input", () => {
  const typingRef = ref(db, `privateChats/${currentChatId}/typing/${currentUser.uid}`);
  set(typingRef, true);

  clearTimeout(window.typingTimeout);
  window.typingTimeout = setTimeout(() => {
    set(typingRef, false);
  }, 2000); // stop typing after 2s idle
});

// Show typing indicator if other user is typing
onValue(ref(db, `privateChats/${currentChatId}/typing`), snapshot => {
  const typingData = snapshot.val() || {};
  const someoneTyping = Object.keys(typingData).some(uid => uid !== currentUser.uid && typingData[uid]);

  typingIndicator.style.display = someoneTyping ? "block" : "none";
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

      const div = document.createElement("div");
      if (msg.sender === auth.currentUser.email) {
        div.className = "message-bubble sender";
      } else {
        div.className = "message-bubble receiver";
      }
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
    });
    privateMessages.scrollTop = privateMessages.scrollHeight;
  });
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

