const express = require('express');
const router = express.Router();

// GET /notifications
// Returns a small list of notifications for the signed-in user.
router.get('/notifications', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ message: 'Not authenticated' });
        }

        const SystemMessage = require('../models/systemMessage');
        const Permit = require('../models/permit');

        const userId = req.session.userId;
        const notifications = [];

        // Latest system message as an info notification
        try {
            const sys = await SystemMessage.findOne({}, {}, { sort: { updatedAt: -1 } }).lean();
            if (sys && sys.message) {
                notifications.push({
                    id: `sys-${sys._id}`,
                    title: 'Admin Message',
                    message: sys.message,
                    type: 'info',
                    timestamp: (sys.updatedAt || sys.createdAt || new Date()).toISOString(),
                    read: false,
                    details: {}
                });
            }
        } catch (err) {
            // non-fatal; continue
            console.warn('Error loading system message for notifications:', err.message || err);
        }

        // Recent permits for the user (submitted by or owned by)
        try {
            const recentPermits = await Permit.find({ $or: [{ requester: userId }, { owner: userId }] })
                .sort({ updatedAt: -1, createdAt: -1 })
                .limit(10)
                .lean();

            recentPermits.forEach(p => {
                const status = (p.status || 'Pending');
                let type = 'info';
                if (String(status).toLowerCase().startsWith('approve')) type = 'success';
                else if (String(status).toLowerCase().startsWith('reject')) type = 'error';
                else if (String(status).toLowerCase().startsWith('pending')) type = 'warning';

                notifications.push({
                    id: `permit-${p._id}`,
                    title: `Permit ${status}`,
                    message: p.permitTitle ? `${p.permitTitle} (${p.permitNumber || p._id})` : `Permit ${p.permitNumber || p._id} status updated to ${status}`,
                    type,
                    timestamp: (p.updatedAt || p.approvedAt || p.createdAt || new Date()).toISOString(),
                    read: false,
                    details: {
                        permitId: p._id,
                        permitNumber: p.permitNumber || null,
                        status: status
                    }
                });
            });
        } catch (err) {
            console.warn('Error loading permits for notifications:', err.message || err);
        }

        // Sort final notifications by timestamp desc
        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ notifications });
    } catch (err) {
        console.error('Notifications endpoint error:', err);
        res.status(500).json({ message: 'Failed to fetch notifications', error: err.message });
    }
});

module.exports = router;
