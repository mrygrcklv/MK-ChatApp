# Data Model and Security Rules Documentation

## Database Structure

### Users Collection
```
users/
├── {uid}/
│   ├── email: string
│   ├── fullName: string
│   ├── online: boolean
│   └── lastSeen: timestamp
```

**Purpose**: Store user profile information and online presence status.

### Private Chats Collection
```
privateChats/
├── {chatId}/  // Format: "uid1_uid2" (UIDs sorted alphabetically)
│   ├── {messageId}/
│   │   ├── sender: string (email)
│   │   ├── text: string
│   │   ├── ts: number (timestamp)
│   │   ├── read: boolean
│   │   └── imageUrl: string (optional)
```

**Purpose**: Store private 1:1 conversations between two users.
**ChatId Format**: Combines two user UIDs in alphabetical order (e.g., "abc123_def456")

### Group Chats Collection
```
groupChats/
├── {groupId}/
│   ├── name: string
│   ├── members: {uid: boolean}
│   ├── createdAt: number (timestamp)
│   └── messages/
│       ├── {messageId}/
│       │   ├── sender: string (email)
│       │   ├── text: string
│       │   ├── ts: number (timestamp)
│       │   └── imageUrl: string (optional)
```

**Purpose**: Store group conversations with multiple participants.

### User Indexes
```
userPrivateChats/
├── {uid}/
│   └── {chatId}: boolean

userGroups/
├── {uid}/
│   └── {groupId}: boolean

groupsByCreator/
├── {uid}/
│   └── {groupId}: boolean
```

**Purpose**: Optimize queries by maintaining user-specific indexes for quick access to user's chats and groups.

### Presence and Activity
```
users/{uid}/online: boolean
users/{uid}/lastSeen: timestamp
groupTyping/{uid}: boolean
privateTyping/{chatId}/{uid}: boolean
```

**Purpose**: Real-time presence tracking and typing indicators.

### Contacts and Pending Messages
```
contacts/
├── {uid}/
│   └── {contactUid}: boolean

pendingMessages/
├── {uid}/
│   └── {fromUid}/
│       └── {messageId}/
│           ├── sender: string
│           ├── text: string
│           ├── ts: number
│           └── read: boolean
```

**Purpose**: Contact management and message approval system for private chats.

## Security Rules Analysis

### 1. Users Collection
```json
"users": {
  ".read": "auth != null",
  "$uid": {
    ".write": "auth != null && auth.uid === $uid"
  }
}
```
**Security**: 
- Any authenticated user can read user data (for user list)
- Only users can write to their own profile

### 2. Private Chats Collection
```json
"privateChats": {
  "$chatId": {
    ".read": "auth != null && (auth.uid == $chatId.split('_')[0] || auth.uid == $chatId.split('_')[1])",
    ".write": "auth != null && (auth.uid == $chatId.split('_')[0] || auth.uid == $chatId.split('_')[1])"
  }
}
```
**Security**: 
- Only participants of a private chat can access it
- ChatId is parsed to extract participant UIDs
- Prevents unauthorized access to private conversations

### 3. Group Chats Collection
```json
"groupChats": {
  "$groupId": {
    ".read": "auth != null && data.child('members/' + auth.uid).val() === true",
    ".write": "auth != null && ((!data.exists() && newData.child('members/' + auth.uid).val() === true) || (data.exists() && data.child('members/' + auth.uid).val() === true))",
    "messages": {
      ".read": "auth != null && root.child('groupChats/' + $groupId + '/members/' + auth.uid).val() === true",
      ".write": "auth != null && root.child('groupChats/' + $groupId + '/members/' + auth.uid).val() === true"
    }
  }
}
```
**Security**: 
- Only group members can access group data and messages
- Membership verification for both read and write operations
- Prevents non-members from accessing group conversations

### 4. User Indexes
```json
"userPrivateChats": {
  "$uid": {
    ".read": "auth != null && auth.uid === $uid",
    "$chatId": {
      ".write": "auth != null && auth.uid === $uid"
    }
  }
}
```
**Security**: 
- Users can only access their own chat indexes
- Prevents unauthorized modification of user's chat list

### 5. Typing Indicators
```json
"privateTyping": {
  "$chatId": {
    ".read": "auth != null && (auth.uid == $chatId.split('_')[0] || auth.uid == $chatId.split('_')[1])",
    ".write": "auth != null && (auth.uid == $chatId.split('_')[0] || auth.uid == $chatId.split('_')[1])"
  }
}
```
**Security**: 
- Only chat participants can see typing indicators
- Prevents privacy leaks about typing activity

## Security Features

### Access Control
1. **Authentication Required**: All operations require user authentication
2. **User-Specific Access**: Users can only modify their own data
3. **Chat Membership**: Access to chats is restricted to participants only
4. **Group Membership**: Group access requires explicit membership

### Data Protection
1. **Private Chat Isolation**: Private chats are completely isolated between participants
2. **Group Member Verification**: Real-time verification of group membership
3. **Contact Privacy**: Users can only manage their own contact lists
4. **Typing Privacy**: Typing indicators only visible to chat participants

### Scalability Considerations
1. **Indexed Queries**: User-specific indexes optimize query performance
2. **ChatId Format**: Consistent format enables efficient rule parsing
3. **Membership Caching**: Group membership stored for quick access
4. **Presence Tracking**: Efficient online status management

## Rule Validation Examples

### ✅ Valid Operations
- User A reads their own profile
- User A and User B access their private chat (chatId: "userA_userB")
- Group member reads group messages
- User updates their own online status
- User adds contact to their contact list

### ❌ Invalid Operations
- User A tries to access User B's private chat with User C
- Non-group member tries to read group messages
- User tries to modify another user's profile
- Unauthenticated user tries to access any data
- User tries to access typing indicators for chats they're not part of

## Performance Optimizations

1. **Selective Reading**: Rules prevent unnecessary data reads
2. **Indexed Access**: User-specific indexes reduce query complexity
3. **Membership Caching**: Group membership stored for quick verification
4. **Minimal Data Transfer**: Only relevant data is accessible to each user
