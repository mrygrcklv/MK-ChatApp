# Firebase Realtime Database Chat App (Extended)

Supports:
- ✅ Sign up / Sign in (Firebase Auth)
- ✅ Group chat (all users together)
- ✅ Private 1:1 chat
- ✅ Online / offline presence

---

## Setup
1. Open folder in VS Code.
2. Create a Firebase project.
3. Enable **Email/Password Auth**.
4. Enable **Realtime Database** → Start in Test mode.
5. Copy config → paste in `app.js`.
6. Replace `databaseURL` with your project URL.
7. Paste `database.rules.json` rules in Firebase Console → Realtime Database → Rules.
8. Open `index.html` in browser.

---

## Data Model
groupMessages/
{id}: { text, sender, ts }

privateChats/
{chatId}/
{id}: { text, sender, ts }

users/
{uid}: { email, online }
---

## Security Rules
- Group chat: only logged in users can read/write.
- Private chats: only participants can access (simplified).
- Users: only owner can update own status.

---

## Limitations
- No typing indicator.
- Private chat rule simplified (all logged-in can read, can be made stricter).
- Online presence clears only on refresh/close.

---

## Next Steps
- Add multiple group rooms.
- Improve private chat rules.
- Add typing indicators, read receipts.


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