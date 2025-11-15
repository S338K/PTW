# In-App Notification System - Complete Guide

## Overview

The notification system is now fully wired up and provides real-time in-app notifications to users for permit-related actions.

## 🎯 Features Implemented

### 1. **Notification Bell Icon**

- Located in the top navigation bar
- Shows a red badge with unread count
- Animated bell icon on hover
- Dropdown panel opens on click

### 2. **Notification Types**

The system supports the following notification types:

| Type               | Icon            | Color  | Trigger                                |
| ------------------ | --------------- | ------ | -------------------------------------- |
| `permit_submitted` | 📄 File         | Blue   | When user submits a new permit         |
| `permit_approved`  | ✅ Check Circle | Green  | When permit is approved (pre or final) |
| `permit_rejected`  | ❌ Times Circle | Red    | When permit is rejected (pre or final) |
| `permit_updated`   | ✏️ Edit         | Yellow | When permit status changes             |
| `system`           | ℹ️ Info Circle  | Gray   | System announcements                   |

### 3. **Notification Triggers**

#### ✅ **Permit Submission**

- **When**: User submits a new permit request
- **Recipient**: The user who submitted the permit
- **Notification**: "Permit Submitted Successfully"
- **Message**: Confirms submission and indicates it's pending review

#### ✅ **Pre-Approval (In Progress)**

- **When**: Pre-approver approves the permit
- **Recipient**: Permit requester
- **Notification**: "Permit Pre-Approved"
- **Status**: Changes to "In Progress"
- **Message**: Indicates pre-approval and awaiting final approval

#### ✅ **Pre-Rejection**

- **When**: Pre-approver rejects the permit
- **Recipient**: Permit requester
- **Notification**: "Permit Rejected"
- **Message**: Shows rejection reason with guidance to resubmit

#### ✅ **Final Approval**

- **When**: Final approver approves the permit
- **Recipient**: Permit requester
- **Notification**: "Permit Approved"
- **Status**: Changes to "Approved"
- **Message**: Congratulates user and provides permit number

#### ✅ **Final Rejection**

- **When**: Final approver rejects the permit
- **Recipient**: Permit requester
- **Notification**: "Permit Rejected"
- **Message**: Shows rejection reason and instructions

### 4. **User Interface Components**

#### **Notification Bell**

```html
<button id="notification-bell">
  <i class="fas fa-bell"></i>
  <span id="notification-badge">3</span>
  <!-- Shows unread count -->
</button>
```

#### **Notification Dropdown**

- Max height: 70vh
- Width: 320px (mobile) / 384px (desktop)
- Shows last 50 notifications
- Auto-scrollable list
- "Mark all as read" button
- "View all notifications" link

#### **Notification Detail Modal**

Opens when clicking on a notification:

- Full notification message
- Timestamp (e.g., "5 minutes ago", "2 hours ago")
- Permit metadata (permit number, status)
- Additional comments from approvers
- Action button to view permit details
- Automatically marks notification as read

### 5. **API Endpoints**

#### **GET /api/notifications**

Fetches all notifications for the logged-in user

```javascript
Response: {
  notifications: [
    {
      _id: "...",
      userId: "...",
      type: "permit_approved",
      title: "Permit Approved",
      message: "Your permit has been approved!",
      read: false,
      metadata: {
        permitId: "...",
        permitNumber: "BHS-...",
        status: "Approved",
        approverName: "John Doe",
        comments: "All requirements met",
      },
      createdAt: "2025-11-06T10:30:00.000Z",
    },
  ];
}
```

#### **PUT /api/notifications/:id/read**

Marks a specific notification as read

```javascript
Response: {
  notification: { ... }
}
```

#### **PUT /api/notifications/mark-all-read**

Marks all notifications as read for the current user

```javascript
Response: {
  message: "All notifications marked as read";
}
```

## 🔧 Technical Implementation

### Backend Files

#### 1. **Model: `backend/models/notification.js`**

```javascript
{
  userId: ObjectId,           // Recipient user
  type: String,               // Notification type
  title: String,              // Short title
  message: String,            // Brief message
  read: Boolean,              // Read status
  metadata: {                 // Additional context
    permitId: String,
    permitNumber: String,
    status: String,
    approverName: String,
    comments: String
  },
  timestamps: true            // createdAt, updatedAt
}
```

#### 2. **Routes: `backend/routes/notifications.js`**

- GET endpoints for fetching notifications
- PUT endpoints for marking as read
- Helper function `createNotification()` exported for other routes

#### 3. **Integration Points**

Notifications are created in:

- ✅ `backend/routes/permit.js` - On permit submission
- ✅ `backend/routes/preApprover.js` - On pre-approval/rejection
- ✅ `backend/routes/api-permit-details.js` - On final approval/rejection

### Frontend Files

#### 1. **HTML: `shared/layout.html`**

- Lines 47-80: Notification bell and dropdown
- Lines 802-850: Notification detail modal

#### 2. **JavaScript: `shared/layout.js`**

- Lines 1575-2017: Complete notification manager
- Functions:
  - `fetchNotifications()` - Loads from API
  - `renderNotifications()` - Updates UI
  - `markAsRead()` - Marks single notification as read
  - `markAllRead()` - Marks all as read
  - `showNotificationDetail()` - Opens modal
  - `getNotificationIcon()` - Returns icon class
  - `getNotificationColor()` - Returns color class
  - `formatNotificationTime()` - Formats relative time

#### 3. **CSS: Theme Support**

- Uses CSS variables: `--text-primary`, `--bg-surface`, `--page-color`
- Dark mode support via `dark:` prefixes
- Smooth animations and transitions

## 🚀 Usage Guide

### For Users

1. **Submit a permit**: You'll receive a confirmation notification
2. **Check notifications**: Click the bell icon in the top right
3. **View details**: Click any notification to see full details
4. **Mark as read**: Notifications are automatically marked as read when clicked
5. **Clear all**: Use "Mark all as read" to clear unread badge

### For Admins/Approvers

When you approve/reject permits:

- The system automatically sends notifications to the requester
- Notifications include your name and comments
- Users receive real-time updates without refreshing

## 📊 Notification Flow Diagram

```
User Submits Permit
    ↓
[Notification: Submitted] → User
    ↓
Pre-Approver Reviews
    ↓
    ├─ Approve → [Notification: In Progress] → User
    │               ↓
    │           Final Approver Reviews
    │               ↓
    │               ├─ Approve → [Notification: Approved] → User
    │               └─ Reject → [Notification: Rejected] → User
    │
    └─ Reject → [Notification: Rejected] → User
```

## 🎨 Customization

### Adding New Notification Types

1. Add type to `backend/models/notification.js` enum
2. Add icon mapping in `getNotificationIcon()` (layout.js)
3. Add color mapping in `getNotificationColor()` (layout.js)
4. Add message template in `buildDetailedMessage()` (layout.js)

### Changing Refresh Interval

```javascript
// In layout.js, line ~1989
setInterval(fetchNotifications, 60000); // Change 60000 (1 minute)
```

### Modifying Notification Count

```javascript
// In backend/routes/notifications.js, line ~20
.limit(50)  // Change to show more/fewer notifications
```

## 🔔 Auto-Refresh

- Notifications refresh every **60 seconds** automatically
- Manual refresh when opening the dropdown
- No page reload required

## 📱 Responsive Design

- Mobile: 320px width dropdown
- Tablet: 384px width dropdown
- Desktop: Full notification detail modal
- Touch-friendly interactions

## ✅ Testing Checklist

- [ ] Submit a new permit → Check for submission notification
- [ ] Pre-approve a permit → Check for in-progress notification
- [ ] Pre-reject a permit → Check for rejection notification
- [ ] Final approve a permit → Check for approval notification
- [ ] Final reject a permit → Check for rejection notification
- [ ] Click notification → Opens detail modal
- [ ] Click "View Permit" → Navigates to permit
- [ ] Mark as read → Badge count decreases
- [ ] Mark all as read → Badge disappears
- [ ] Wait 60 seconds → New notifications appear automatically
- [ ] Test in dark mode → Colors and contrast correct
- [ ] Test on mobile → Dropdown fits screen

## 🐛 Troubleshooting

### Notifications not appearing?

1. Check browser console for errors
2. Verify user is logged in (check session)
3. Ensure backend server is running on port 5000
4. Check MongoDB connection
5. Verify notification routes are registered in server.js

### Badge not updating?

1. Check if `renderNotifications()` is called after fetch
2. Verify unread count calculation in frontend
3. Check if notifications array is populated

### Modal not opening?

1. Verify `notification-detail-modal` exists in HTML
2. Check JavaScript console for errors
3. Ensure event listeners are attached

## 📝 Database Indexes

Optimized for performance:

```javascript
{ userId: 1, createdAt: -1 }  // Fetch by user, sorted by date
{ userId: 1, read: 1 }         // Filter by read status
```

## 🎯 Future Enhancements (Optional)

- [ ] Push notifications (browser)
- [ ] Email notifications
- [ ] SMS notifications
- [ ] Notification preferences/settings
- [ ] Custom notification sounds
- [ ] Mark multiple as read (checkboxes)
- [ ] Archive old notifications
- [ ] Notification categories/filters

## 🔗 Related Files

- `backend/models/notification.js` - Database schema
- `backend/routes/notifications.js` - API endpoints
- `backend/routes/permit.js` - Submission notifications
- `backend/routes/preApprover.js` - Pre-approval notifications
- `backend/routes/api-permit-details.js` - Final approval notifications
- `shared/layout.html` - UI components
- `shared/layout.js` - Frontend logic

---

**System Status**: ✅ Fully Operational

The notification system is now completely wired up and ready to use!
