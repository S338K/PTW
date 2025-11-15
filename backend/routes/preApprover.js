const express = require('express');
const router = express.Router();
const Permit = require('../models/permit');
const { requireAuth, requirePreApprover } = require('../middleware/authMiddleware');
const { createNotification } = require('./notifications');

// ----- GET /preapprover/stats -----
router.get('/stats', requireAuth, requirePreApprover, async (req, res) => {
  try {
    const [pending, inProgress, approved, rejected] = await Promise.all([
      Permit.countDocuments({ status: 'Pending' }),
      Permit.countDocuments({ status: 'In Progress' }),
      Permit.countDocuments({ status: 'Approved' }),
      Permit.countDocuments({ status: 'Rejected' }),
    ]);

    res.json({ pending, inProgress, approved, rejected });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ----- GET /preapprover/permits -----
// List all permits that are still Pending
router.get('/permits', requireAuth, requirePreApprover, async (req, res) => {
  try {
    const permits = await Permit.find({ status: 'Pending' })
      .populate('requester', 'username email')
      .sort({ createdAt: -1 });
    res.json(permits);
  } catch (err) {
    console.error('Permits fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch permits' });
  }
});

// ----- POST /preapprover/approve/:id -----
router.post('/approve/:id', requireAuth, requirePreApprover, async (req, res) => {
  try {
    const { comments } = req.body;

    // Use req.user._id if available, fallback to req.session.userId
    const preApproverId = req.user?._id || req.session.userId;
    const preApproverName = req.user?.fullName || req.user?.username || 'Pre-Approver';

    const updated = await Permit.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'In Progress',
          preApprovedBy: preApproverId,
          preApprovedAt: new Date(),
          preApproverComments: comments || '',
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Create notification for permit requester
    try {
      await createNotification(
        updated.requester,
        'permit_approved',
        'Permit Pre-Approved',
        `Your permit "${updated.permitTitle || updated.permitNumber || 'N/A'}" has been pre-approved and moved to In Progress.`,
        {
          permitId: updated._id.toString(),
          permitNumber: updated.permitNumber,
          status: 'In Progress',
          approverName: preApproverName,
          comments: comments || '',
        }
      );
    } catch (notifErr) {
      console.error('Failed to create notification:', notifErr);
      // Don't fail the request if notification fails
    }

    res.json({ message: 'Permit moved to In Progress', permit: updated });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Failed to update permit' });
  }
});

// ----- POST /preapprover/reject/:id -----
router.post('/reject/:id', requireAuth, requirePreApprover, async (req, res) => {
  try {
    const { comments } = req.body;

    // Use req.user._id if available, fallback to req.session.userId
    const preApproverId = req.user?._id || req.session.userId;
    const preApproverName = req.user?.fullName || req.user?.username || 'Pre-Approver';

    const updated = await Permit.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: 'Rejected',
          preApprovedBy: preApproverId,
          preApprovedAt: new Date(),
          preApproverComments: comments || '',
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Permit not found' });
    }

    // Create notification for permit requester
    try {
      await createNotification(
        updated.requester,
        'permit_rejected',
        'Permit Rejected',
        `Your permit "${updated.permitTitle || updated.permitNumber || 'N/A'}" has been rejected.`,
        {
          permitId: updated._id.toString(),
          permitNumber: updated.permitNumber,
          status: 'Rejected',
          approverName: preApproverName,
          comments: comments || '',
        }
      );
    } catch (notifErr) {
      console.error('Failed to create notification:', notifErr);
    }

    res.json({ message: 'Permit rejected successfully', permit: updated });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'Failed to reject permit' });
  }
});

module.exports = router;
