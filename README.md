# MK Chat App - Real-time Firebase Chat Application

A comprehensive real-time chat application built with Firebase that supports user authentication, private messaging, group chats, online presence, typing indicators, read receipts, and image sharing.

## Features

### Core Requirements ✅
- **Authentication**: Firebase Authentication with email/password signup and login
- **Real-time Chat**: Instant message delivery using Firebase Realtime Database
- **Multiple Chat Types**: Both 1:1 private chats and group chats
- **User Management**: User list with online/offline status (excluding self)
- **Security**: Firebase Security Rules ensuring only chat members can access messages
- **Message Features**: Sender identification, timestamps, and instant delivery

### Bonus Features ✅
- **Typing Indicators**: Real-time typing status for both group and private chats
- **Read Receipts**: Message read status in private conversations
- **Image Sharing**: Upload and share images in both group and private chats
- **Online Presence**: Real-time online/offline status with last seen timestamps
- **Contact Management**: Add contacts by user ID for easy private messaging
- **Group Creation**: Create and manage multiple group chats

## Setup Instructions

### 1. Firebase Project Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable the following services:
   - **Authentication** → Sign-in method → Email/Password
   - **Realtime Database** → Create database → Start in test mode
   - **Storage** → Get started (for image sharing)

### 2. Configuration
1. Go to Project Settings → General → Your apps
2. Add a web app and copy the Firebase configuration
3. Replace the `firebaseConfig` object in `app.js` with your project's configuration
4. Update the `databaseURL` to match your project's Realtime Database URL

### 3. Security Rules
1. Go to Realtime Database → Rules
2. Replace the default rules with the contents of `database.rules.json`
3. Publish the rules

### 4. Run the Application
1. Open `index.html` in a web browser
2. Sign up with a new account or login with existing credentials
3. Start chatting!

## Data Model

### Users
```
users/
  {uid}/
    email: "user@example.com"
    fullName: "John Doe"
    online: true/false
    lastSeen: timestamp
```

### Private Chats
```
privateChats/
  {chatId}/  // Format: "uid1_uid2" (sorted alphabetically)
    {messageId}/
      sender: "user@example.com"
      text: "Hello!"
      ts: timestamp
      read: true/false
      imageUrl: "url" (optional)
```

### Group Chats
```
groupChats/
  {groupId}/
    name: "Group Name"
    members: {uid: true, uid2: true}
    createdAt: timestamp
    messages/
      {messageId}/
        sender: "user@example.com"
        text: "Hello group!"
        ts: timestamp
        imageUrl: "url" (optional)
```

### Presence & Typing
```
users/{uid}/online: true/false
users/{uid}/lastSeen: timestamp
groupTyping/{uid}: true/false
privateTyping/{chatId}/{uid}: true/false
```

## Security Rules Explanation

The Firebase Security Rules ensure that:

1. **User Data**: Only authenticated users can read user data, only users can update their own profile
2. **Private Chats**: Only participants (based on chatId format) can read/write messages
3. **Group Chats**: Only group members can access group data and messages
4. **Contacts**: Users can only manage their own contact list
5. **Typing Indicators**: Only chat participants can see typing status
6. **Presence**: Users can only update their own online status

Key security features:
- Chat membership verification for group access
- Participant-only access for private chats using chatId parsing
- User-specific access controls for personal data
- Authentication requirement for all operations

## Demo Flow

1. **Sign In**: Create account or login with existing credentials
2. **User List**: View all other users with online/offline status
3. **Start Chat**: Click on user to start private conversation
4. **Group Chat**: Create or join group chats
5. **Real-time Features**: Experience instant messaging, typing indicators, read receipts
6. **Image Sharing**: Upload and share images in conversations
7. **Security Test**: Verify that non-members cannot access private chats

## Limitations

- Private chat access rules simplified (could be stricter with UID validation)
- No message encryption (messages stored in plain text)
- No message editing or deletion
- No file sharing beyond images
- No push notifications
- No message search functionality

## Next Steps

- Implement end-to-end encryption for messages
- Add message editing and deletion capabilities
- Implement push notifications
- Add message search and filtering
- Create mobile app version
- Add voice/video calling features
- Implement message reactions and replies
- Add user profile pictures and status updates
