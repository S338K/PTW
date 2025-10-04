const express = require("express");
const router = express.Router();
const Permit = require("../models/Permit");
const { requireAuth, requirePreApprover } = require("../middleware/authMiddleware");

// ----- GET /preapprover/stats -----
router.get("/stats", requireAuth, requirePreApprover, async (req, res) => {
    try {
        const [pending, inProgress, approved, rejected] = await Promise.all([
            Permit.countDocuments({ status: "Pending" }),
            Permit.countDocuments({ status: "In Progress" }),
            Permit.countDocuments({ status: "Approved" }),
            Permit.countDocuments({ status: "Rejected" })
        ]);

        res.json({ pending, inProgress, approved, rejected });
    } catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

// ----- GET /preapprover/permits -----
// List all permits that are still Pending
router.get("/permits", requireAuth, requirePreApprover, async (req, res) => {
    try {
        const permits = await Permit.find({ status: "Pending" })
            .populate("requester", "username email")
            .sort({ createdAt: -1 });
        res.json(permits);
    } catch (err) {
        console.error("Permits fetch error:", err);
        res.status(500).json({ error: "Failed to fetch permits" });
    }
});

// ----- POST /preapprover/approve/:id -----
router.post("/approve/:id", requireAuth, requirePreApprover, async (req, res) => {
    try {
        const { comments } = req.body;

        const updated = await Permit.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status: "In Progress",   // ✅ updated per your workflow
                    preApprovedBy: req.session.userId,
                    preApprovedAt: new Date(),
                    preApproverComments: comments || ""
                }
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Permit not found" });
        }

        res.json({ message: "Permit moved to In Progress", permit: updated });
    } catch (err) {
        console.error("Approve error:", err);
        res.status(500).json({ error: "Failed to update permit" });
    }
});

// ----- POST /preapprover/reject/:id -----
router.post("/reject/:id", requireAuth, requirePreApprover, async (req, res) => {
    try {
        const { comments } = req.body;

        const updated = await Permit.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status: "Rejected",
                    preApprovedBy: req.session.userId,
                    preApprovedAt: new Date(),
                    preApproverComments: comments || ""
                }
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ error: "Permit not found" });
        }

        res.json({ message: "Permit rejected successfully", permit: updated });
    } catch (err) {
        console.error("Reject error:", err);
        res.status(500).json({ error: "Failed to reject permit" });
    }
});

module.exports = router;
