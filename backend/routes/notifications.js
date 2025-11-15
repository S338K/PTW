const express = require('express');
const router = express.Router();
const Notification = require('../models/notification');

// GET /notifications or /api/notifications
// Returns notifications for the signed-in user from the database
router.get(['/notifications', '/api/notifications'], async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const userId = req.session.userId;

    // Fetch only unread notifications from database
    const notifications = await Notification.find({ userId, read: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Transform to expected format
    const formattedNotifications = notifications.map((n) => ({
      _id: n._id,
      id: n._id.toString(),
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      metadata: n.metadata || {},
      createdAt: n.createdAt,
      timestamp: n.createdAt,
    }));

    res.json({ notifications: formattedNotifications });
  } catch (err) {
    console.error('Notifications endpoint error:', err);
    res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
  }
});

// PUT /api/notifications/:id/read
// Mark a specific notification as read
router.put('/api/notifications/:id/read', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
});

// PUT /api/notifications/mark-all-read
// Mark all notifications as read for the current user
router.put('/api/notifications/mark-all-read', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    await Notification.updateMany({ userId: req.session.userId, read: false }, { read: true });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
});

// Helper function to create a notification (exported for use by other routes)
async function createNotification(userId, type, title, message, metadata = {}) {
  try {
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      metadata,
      read: false,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

module.exports = router;
module.exports.createNotification = createNotification;
